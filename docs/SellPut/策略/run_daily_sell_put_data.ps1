param(
    [string]$Symbols = "QLD,EEM,TQQQ,GDX,ARKK,IBIT,SOFI,RIVN,SMCI,INTC,MSTR,MARA,RIOT,IONQ,HOOD,PLTR",
    [int]$OptionChainLimit = 300,
    [string]$Jin10Keyword = "jin10_data_digest",
    [string]$Jin10EncodedKeyword = "%E9%87%91%E5%8D%81%E6%95%B0%E6%8D%AE%E6%95%B4%E7%90%86",
    [string]$Jin10SearchType = "flash",
    [string]$Jin10WindowMode = "SellPut",
    [string]$Jin10CutoffDateTime = "",
    [int]$Jin10Limit = 8,
    [string]$OutDir = "outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $scriptDir "..\..\..\..")).Path
$fetchScriptDir = Join-Path $rootDir "scripts"
$resolvedOutDir = Join-Path $rootDir $OutDir

if (-not (Test-Path -LiteralPath $resolvedOutDir)) {
    New-Item -ItemType Directory -Path $resolvedOutDir | Out-Null
}

$date = Get-Date -Format "yyyy-MM-dd"
$overviewFile = Join-Path $resolvedOutDir "barchart_options_overview_$date.csv"
$chainFile = Join-Path $resolvedOutDir "nasdaq_put_chain_$date.csv"
$jin10File = Join-Path $resolvedOutDir "jin10_market_news_$date.csv"
$summaryFile = Join-Path $resolvedOutDir "daily_sell_put_data_pack_$date.md"

Push-Location $rootDir
try {
    & (Join-Path $fetchScriptDir "fetch_barchart_options_overview.ps1") -Symbols $Symbols -OutDir $OutDir
    & (Join-Path $fetchScriptDir "fetch_nasdaq_put_chain.ps1") -Symbols $Symbols -Limit $OptionChainLimit -OutDir $OutDir
    & (Join-Path $fetchScriptDir "fetch_jin10_market_news.ps1") -Keyword $Jin10Keyword -EncodedKeyword $Jin10EncodedKeyword -SearchType $Jin10SearchType -WindowMode $Jin10WindowMode -CutoffDateTime $Jin10CutoffDateTime -Limit $Jin10Limit -OutDir $OutDir
}
finally {
    Pop-Location
}

$overviewRows = Import-Csv -LiteralPath $overviewFile
$chainRows = Import-Csv -LiteralPath $chainFile
$jin10Rows = @()
if (Test-Path -LiteralPath $jin10File) {
    $jin10Rows = Import-Csv -LiteralPath $jin10File
}

function To-DoubleOrNull {
    param([object]$Value)
    if ($null -eq $Value -or $Value -eq "") {
        return $null
    }
    return [double]$Value
}

function Format-Value {
    param([object]$Value)
    if ($null -eq $Value -or $Value -eq "") {
        return ""
    }
    return [string]$Value
}

$lines = @()
$lines += "# Daily Sell Put Data Pack - $date"
$lines += ""
$lines += "## Data Files"
$lines += ""
$lines += "- Barchart options overview: $overviewFile"
$lines += "- Nasdaq put chain: $chainFile"
$lines += "- Jin10 market news: $jin10File"
$lines += ""
$lines += "## Daily JPY Carry Trade Risk Check"
$lines += ""
$lines += "This is a mandatory daily macro-risk checkpoint. It should be reviewed separately from ordinary market-wind inputs before opening QLD/TQQQ/QQQ/SMH/SOXX/SOXL or mega-cap tech related sell-put positions."
$lines += ""
$lines += "Required output in the daily analysis:"
$lines += ""
$lines += '```text'
$lines += "JPY Carry Risk: No obvious signal / Watch signal / Downgrade triggered"
$lines += '```'
$lines += ""
$lines += "| Indicator | Check | Sell Put Impact |"
$lines += "|---|---|---|"
$lines += "| USDJPY | Is JPY strengthening quickly or breaking key levels? | Fast JPY appreciation can force carry-trade unwind. Downgrade Nasdaq/high-beta sell puts. |"
$lines += "| Japan 10Y JGB / JGB yields | Are Japanese yields rising quickly? | Higher JPY funding cost can pressure global risk assets. |"
$lines += "| BOJ / Japan MOF comments | Any rate-hike, FX intervention, or currency warning language? | Policy trigger risk. Avoid new high-beta put selling if active. |"
$lines += "| VIX | Is VIX rising quickly? | Treat high premiums as risk explosion, not automatic opportunity. |"
$lines += "| QQQ vs SPY | Is QQQ materially weaker than SPY? | Liquidity assets / mega-cap tech may be used as funding source. |"
$lines += "| SMH / SOXX / mega-cap tech | Are semis or Seven Sisters leading lower? | Downgrade QLD/TQQQ/SOXL/AI-related sell puts. |"
$lines += "| DXY / US yields | Any disorderly USD or rate movement? | Check for broader liquidity stress. |"
$lines += ""
$lines += "Rule: if JPY carry risk is marked `Downgrade triggered`, do not open new Nasdaq/high-beta sell puts just because annualized yield is high. First wait for forced selling to slow, price to stabilize, and IV to remain elevated."
$lines += ""
$lines += "## Market News Inputs"
$lines += ""
$lines += "Source: Jin10 search keyword `$Jin10Keyword`, type `$Jin10SearchType`, window `$Jin10WindowMode`. Use these as market-wind inputs, not as standalone trade conclusions."
$lines += ""
$lines += "| Time | Title | Market Relevance |"
$lines += "|---|---|---|"

foreach ($row in $jin10Rows) {
    $summary = $row.Summary
    $relevance = "Review for macro/geopolitical, oil, VIX, policy, AI/semiconductor, crypto, or single-stock event impact."
    if ($summary -match "伊朗|霍尔木兹|封锁|石油|油价|中东") {
        $relevance = "Geopolitical/oil-risk input; affects market wind, VIX, inflation expectations, and high-beta risk appetite."
    }
    elseif ($summary -match "英伟达|NVDA|AI|人工智能|半导体|芯片") {
        $relevance = "AI/semiconductor input; affects QLD and INTC risk bucket."
    }
    elseif ($summary -match "特斯拉|TSLA|美股|个股") {
        $relevance = "US-stock single-name input; review for risk appetite and event spillover."
    }

    $title = ($row.Title -replace '\|','/')
    $lines += "| $($row.Time) | $title | $relevance |"
}

$lines += ""
$lines += "## Options Overview"
$lines += ""
$lines += "| Symbol | IV | IV Change | HV | IV Percentile | IV Rank | Expected Move | Expected Range | Put/Call Vol | Put/Call OI | Today Volume | Today OI |"
$lines += "|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|"

foreach ($row in $overviewRows) {
    $range = ""
    if ($row.ExpectedRangeLow -and $row.ExpectedRangeHigh) {
        $range = "$($row.ExpectedRangeLow) to $($row.ExpectedRangeHigh)"
    }

    $lines += "| $($row.Symbol) | $($row.ImpliedVolatilityPct)% | $($row.ImpliedVolatilityChangePct)% | $($row.HistoricalVolatilityPct)% | $($row.IVPercentilePct)% | $($row.IVRankPct)% | $($row.ExpectedMove) / $($row.ExpectedMovePct)% | $range | $($row.PutCallVolRatio) | $($row.PutCallOIRatio) | $($row.TodaysVolume) | $($row.TodaysOpenInterest) |"
}

$lines += ""
$lines += "## Put Chain First Pass"
$lines += ""
$lines += "Filter: PutAsk > 0 and PutOpenInterest >= 100. Nasdaq public data often lacks Bid, so blank SpreadPct is only an observation flag, not executable price confirmation."
$lines += ""
$lines += "| Symbol | Expiry Group | Strike | Bid | Ask | Mid | SpreadPct | Volume | OI | Ask/Strike |"
$lines += "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"

$selectedRows = foreach ($row in $chainRows) {
    $ask = To-DoubleOrNull $row.PutAsk
    $oi = To-DoubleOrNull $row.PutOpenInterest
    if ($null -ne $ask -and $ask -gt 0 -and $null -ne $oi -and $oi -ge 100) {
        $row
    }
}

foreach ($symbolGroup in ($selectedRows | Group-Object Symbol)) {
    $previewRows = $symbolGroup.Group |
        Sort-Object @{ Expression = { To-DoubleOrNull $_.Strike }; Ascending = $true } |
        Select-Object -First 12

    foreach ($row in $previewRows) {
        $lines += "| $($row.Symbol) | $($row.ExpiryGroup) | $($row.Strike) | $(Format-Value $row.PutBid) | $(Format-Value $row.PutAsk) | $(Format-Value $row.PutMid) | $(Format-Value $row.SpreadPct) | $(Format-Value $row.PutVolume) | $(Format-Value $row.PutOpenInterest) | $(Format-Value $row.PremiumYieldOnAsk) |"
    }
}

$lines += ""
$lines += "## How To Use"
$lines += ""
$lines += "1. Use market wind and individual technical structure first to decide which symbols may enter the sell-put candidate set."
$lines += "2. Use this data pack to check IV, IV Rank, Expected Move, Put/Call, OI, and volume."
$lines += "3. Confirm the exact option contract with Delta, DTE, safety cushion, support level, and executable bid/ask."
$lines += ""
$lines += "## Limits"
$lines += ""
$lines += "- Barchart page scraping is not an official API; page structure changes can break the script."
$lines += "- Nasdaq public option-chain data lacks Delta, IV, and Greeks; it is only suitable for price, OI, volume, and spread screening."
$lines += "- Before trading, confirm real-time bid/ask, margin, volume, and event risk in the broker platform."

$lines | Set-Content -LiteralPath $summaryFile -Encoding UTF8

Write-Host "Daily sell-put data pack generated:"
Write-Host "  $overviewFile"
Write-Host "  $chainFile"
Write-Host "  $jin10File"
Write-Host "  $summaryFile"
