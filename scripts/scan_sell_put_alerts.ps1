param(
    [string]$Symbols = "QLD,EEM,TQQQ,GDX,ARKK,IBIT,SOFI,RIVN,SMCI,INTC,MSTR,MARA,RIOT,IONQ,HOOD,PLTR",
    [string]$OutDir = "outputs",
    [string]$ChainFile = "",
    [string]$OverviewFile = "",
    [double]$MinAbsDelta = 0.12,
    [double]$MaxAbsDelta = 0.18,
    [int]$MinDte = 4,
    [int]$MaxDte = 10,
    [double]$MinAnnualized = 0.30,
    [double]$RiskFreeRate = 0.05,
    [int]$MinOpenInterest = 50,
    [int]$WeeklyAtrPeriod = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$date = Get-Date -Format "yyyy-MM-dd"
if (-not $ChainFile) {
    $ChainFile = Join-Path $OutDir "nasdaq_put_chain_$date.csv"
}
if (-not $OverviewFile) {
    $OverviewFile = Join-Path $OutDir "barchart_options_overview_$date.csv"
}

if (-not (Test-Path -LiteralPath $ChainFile)) {
    throw "Option chain file not found: $ChainFile. Run fetch_nasdaq_put_chain.ps1 first."
}
if (-not (Test-Path -LiteralPath $OverviewFile)) {
    throw "Options overview file not found: $OverviewFile. Run fetch_barchart_options_overview.ps1 first."
}

function To-DoubleOrNull {
    param([object]$Value)

    if ($null -eq $Value) { return $null }
    $text = ([string]$Value).Trim()
    if ($text -eq "" -or $text -eq "--") { return $null }

    $text = $text.Replace(",", "").Replace("%", "")
    $out = 0.0
    if ([double]::TryParse($text, [ref]$out)) { return $out }
    return $null
}

function Get-NormalCdf {
    param([double]$X)

    $sign = if ($X -lt 0) { -1.0 } else { 1.0 }
    $xAbs = [math]::Abs($X) / [math]::Sqrt(2.0)
    $t = 1.0 / (1.0 + 0.3275911 * $xAbs)
    $a1 = 0.254829592
    $a2 = -0.284496736
    $a3 = 1.421413741
    $a4 = -1.453152027
    $a5 = 1.061405429
    $erf = 1.0 - (((((($a5 * $t + $a4) * $t) + $a3) * $t + $a2) * $t + $a1) * $t) * [math]::Exp(-1.0 * $xAbs * $xAbs)
    return 0.5 * (1.0 + $sign * $erf)
}

function Get-PutDelta {
    param(
        [double]$Spot,
        [double]$Strike,
        [double]$Iv,
        [double]$Years,
        [double]$Rate
    )

    if ($Spot -le 0 -or $Strike -le 0 -or $Iv -le 0 -or $Years -le 0) { return $null }
    $d1 = ([math]::Log($Spot / $Strike) + (($Rate + 0.5 * $Iv * $Iv) * $Years)) / ($Iv * [math]::Sqrt($Years))
    return (Get-NormalCdf $d1) - 1.0
}

function Get-YahooChartResult {
    param(
        [string]$Symbol,
        [string]$Interval,
        [string]$Range
    )

    $escapedSymbol = [uri]::EscapeDataString($Symbol)
    $url = "https://query1.finance.yahoo.com/v8/finance/chart/$escapedSymbol?interval=$Interval&range=$Range&events=history&includePrePost=false"
    $headers = @{ "User-Agent" = "Mozilla/5.0" }

    try {
        $json = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 25).Content
        $obj = $json | ConvertFrom-Json
        return $obj.chart.result[0]
    }
    catch {
        Write-Warning "Failed to fetch Yahoo chart for ${Symbol} (${Interval}/${Range}): $($_.Exception.Message)"
        return $null
    }
}

function Get-YahooSpot {
    param([string]$Symbol)

    $result = Get-YahooChartResult -Symbol $Symbol -Interval "1m" -Range "1d"
    if ($null -eq $result) { return $null }
    $price = To-DoubleOrNull $result.meta.regularMarketPrice
    if ($null -ne $price -and $price -gt 0) { return $price }
    return $null
}

function Get-YahooWeeklyAtr {
    param(
        [string]$Symbol,
        [int]$Period = 14
    )

    $result = Get-YahooChartResult -Symbol $Symbol -Interval "1wk" -Range "1y"
    if ($null -eq $result -or $null -eq $result.indicators.quote[0]) { return $null }

    $quote = $result.indicators.quote[0]
    $highs = @($quote.high)
    $lows = @($quote.low)
    $closes = @($quote.close)
    $trueRanges = @()

    for ($i = 0; $i -lt $closes.Count; $i++) {
        $high = To-DoubleOrNull $highs[$i]
        $low = To-DoubleOrNull $lows[$i]
        $close = To-DoubleOrNull $closes[$i]
        if ($null -eq $high -or $null -eq $low -or $null -eq $close) { continue }

        if ($i -eq 0) {
            $trueRanges += ($high - $low)
            continue
        }

        $previousClose = To-DoubleOrNull $closes[$i - 1]
        if ($null -eq $previousClose) { continue }
        $trueRange = [math]::Max(
            $high - $low,
            [math]::Max([math]::Abs($high - $previousClose), [math]::Abs($low - $previousClose))
        )
        $trueRanges += $trueRange
    }

    if ($trueRanges.Count -lt $Period) { return $null }
    $recent = @($trueRanges | Select-Object -Last $Period)
    $atr = ($recent | Measure-Object -Average).Average
    if ($null -eq $atr -or $atr -le 0) { return $null }
    return [math]::Round([double]$atr, 4)
}

function Get-ExpiryDate {
    param([string]$ExpiryGroup, [string]$Expiry)

    $candidates = @()
    if ($ExpiryGroup) { $candidates += $ExpiryGroup }
    if ($Expiry) { $candidates += "$Expiry, $((Get-Date).Year)" }

    foreach ($candidate in $candidates) {
        $parsed = [datetime]::MinValue
        if ([datetime]::TryParse($candidate, [ref]$parsed)) { return $parsed.Date }
    }
    return $null
}

function Get-AtrSafetyJudgement {
    param(
        [double]$AbsDelta,
        [object]$BreakevenAtrMultiple
    )

    if ($null -eq $BreakevenAtrMultiple) { return "ATR data unavailable" }
    $multiple = [double]$BreakevenAtrMultiple

    if ($AbsDelta -le 0.15) {
        if ($multiple -ge 1.5) { return "Preferred: enter technical confirmation" }
        if ($multiple -ge 1.0) { return "Normal: require ABC stabilization and momentum improvement" }
        return "Insufficient distance: do not rely on Delta alone"
    }

    if ($AbsDelta -gt 0.20) {
        if ($multiple -ge 1.5) { return "Check high IV, earnings and event risk" }
        return "Aggressive: usually exclude"
    }

    if ($multiple -ge 1.5) { return "Watchlist: require stronger technical confirmation" }
    return "Risk elevated"
}

$chainRows = Import-Csv -LiteralPath $ChainFile
$overviewRows = Import-Csv -LiteralPath $OverviewFile
$symbolsToScan = $Symbols.Split(",") | ForEach-Object { $_.Trim().ToUpper() } | Where-Object { $_ -and $_ -ne "CRCL" }

$overviewBySymbol = @{}
$fallbackSpotBySymbol = @{}
foreach ($row in $overviewRows) {
    $ivPct = To-DoubleOrNull $row.ImpliedVolatilityPct
    if ($row.Symbol -and $null -ne $ivPct -and $ivPct -gt 0) {
        $overviewBySymbol[$row.Symbol.ToUpper()] = $ivPct / 100.0
    }

    $rangeLow = To-DoubleOrNull $row.ExpectedRangeLow
    $rangeHigh = To-DoubleOrNull $row.ExpectedRangeHigh
    if ($row.Symbol -and $null -ne $rangeLow -and $null -ne $rangeHigh -and $rangeLow -gt 0 -and $rangeHigh -gt $rangeLow) {
        $fallbackSpotBySymbol[$row.Symbol.ToUpper()] = [math]::Round(($rangeLow + $rangeHigh) / 2.0, 4)
    }
}

$spotBySymbol = @{}
$weeklyAtrBySymbol = @{}
foreach ($symbol in $symbolsToScan) {
    $spot = Get-YahooSpot -Symbol $symbol
    if ($null -eq $spot -and $fallbackSpotBySymbol.ContainsKey($symbol)) {
        $spot = $fallbackSpotBySymbol[$symbol]
    }
    $spotBySymbol[$symbol] = $spot
    $weeklyAtrBySymbol[$symbol] = Get-YahooWeeklyAtr -Symbol $symbol -Period $WeeklyAtrPeriod
}

$today = (Get-Date).Date
$alerts = @()

foreach ($row in $chainRows) {
    $symbol = ([string]$row.Symbol).ToUpper()
    if ($symbol -notin $symbolsToScan) { continue }

    $spot = $spotBySymbol[$symbol]
    $iv = $overviewBySymbol[$symbol]
    if ($null -eq $spot -or $null -eq $iv) { continue }

    $expiryDate = Get-ExpiryDate -ExpiryGroup $row.ExpiryGroup -Expiry $row.Expiry
    if ($null -eq $expiryDate) { continue }

    $dte = ($expiryDate - $today).Days
    if ($dte -lt $MinDte -or $dte -gt $MaxDte) { continue }

    $strike = To-DoubleOrNull $row.Strike
    $bid = To-DoubleOrNull $row.PutBid
    $ask = To-DoubleOrNull $row.PutAsk
    $oi = To-DoubleOrNull $row.PutOpenInterest
    $volume = To-DoubleOrNull $row.PutVolume

    if ($null -eq $strike -or $null -eq $bid -or $null -eq $ask -or $ask -le 0 -or $bid -lt 0) { continue }
    if ($null -ne $oi -and $oi -lt $MinOpenInterest) { continue }

    $mid = [math]::Round(($bid + $ask) / 2.0, 4)
    if ($mid -le 0) { continue }

    $putDelta = Get-PutDelta -Spot $spot -Strike $strike -Iv $iv -Years ($dte / 365.0) -Rate $RiskFreeRate
    if ($null -eq $putDelta) { continue }

    $absDelta = [math]::Abs($putDelta)
    if ($absDelta -lt $MinAbsDelta -or $absDelta -gt $MaxAbsDelta) { continue }

    $annualized = ($mid / $strike) * 365.0 / $dte
    if ($annualized -lt $MinAnnualized) { continue }

    $safety = ($spot - $strike) / $spot
    $spreadPct = if ($mid -gt 0) { ($ask - $bid) / $mid } else { $null }
    $weeklyAtr = $weeklyAtrBySymbol[$symbol]
    $breakevenPrice = $strike - $mid
    $strikeAtrMultiple = $null
    $breakevenAtrMultiple = $null
    if ($null -ne $weeklyAtr -and $weeklyAtr -gt 0) {
        $strikeAtrMultiple = ($spot - $strike) / $weeklyAtr
        $breakevenAtrMultiple = ($spot - $breakevenPrice) / $weeklyAtr
    }

    $alerts += [pscustomobject]@{
        Symbol = $symbol
        Spot = [math]::Round($spot, 4)
        Expiry = $expiryDate.ToString("yyyy-MM-dd")
        DTE = $dte
        Strike = $strike
        Bid = $bid
        Ask = $ask
        Mid = $mid
        BreakevenPrice = [math]::Round($breakevenPrice, 4)
        EstimatedDelta = [math]::Round($putDelta, 4)
        AbsDelta = [math]::Round($absDelta, 4)
        WeeklyATR14 = if ($null -ne $weeklyAtr) { [math]::Round($weeklyAtr, 4) } else { $null }
        StrikeAtrMultiple = if ($null -ne $strikeAtrMultiple) { [math]::Round($strikeAtrMultiple, 2) } else { $null }
        BreakevenAtrMultiple = if ($null -ne $breakevenAtrMultiple) { [math]::Round($breakevenAtrMultiple, 2) } else { $null }
        AtrSafetyJudgement = Get-AtrSafetyJudgement -AbsDelta $absDelta -BreakevenAtrMultiple $breakevenAtrMultiple
        SymbolIV = [math]::Round($iv, 4)
        SafetyPct = [math]::Round($safety * 100.0, 2)
        AnnualizedPct = [math]::Round($annualized * 100.0, 2)
        SpreadPct = if ($null -ne $spreadPct) { [math]::Round($spreadPct * 100.0, 2) } else { $null }
        Volume = $volume
        OpenInterest = $oi
        DeltaSource = "estimated_from_barchart_symbol_iv"
        AtrSource = "yahoo_weekly_ohlc_atr_$WeeklyAtrPeriod"
        PriceSource = "nasdaq_public_bid_ask"
        RetrievedAt = (Get-Date).ToString("s")
    }
}

$alerts = @($alerts | Sort-Object Symbol, DTE, AbsDelta)
$csvFile = Join-Path $OutDir "sell_put_delta_alerts_$date.csv"
$mdFile = Join-Path $OutDir "sell_put_delta_alerts_$date.md"

$alerts | Export-Csv -LiteralPath $csvFile -NoTypeInformation -Encoding UTF8

$lines = @()
$lines += "# Sell Put Delta Alerts - $date"
$lines += ""
$lines += "Filter: abs estimated Delta $MinAbsDelta-$MaxAbsDelta, DTE $MinDte-$MaxDte, Mid annualized >= $([math]::Round($MinAnnualized * 100, 2))%, CRCL excluded."
$lines += ""
$lines += "Breakeven ATR multiple = (spot - (strike - mid premium)) / weekly ATR($WeeklyAtrPeriod). This measures the safety distance to the actual breakeven price after premium, rather than only to the strike."
$lines += ""
$lines += "Important: Delta is estimated with Black-Scholes from symbol-level Barchart IV, not broker real-time Greeks. Weekly ATR is calculated from Yahoo weekly OHLC. Confirm real Delta and executable bid/ask in Futu before trading."
$lines += ""
$lines += "| Symbol | Spot | Expiry | DTE | Strike | Mid | Breakeven | Est Delta | Weekly ATR14 | Strike ATR | Breakeven ATR | ATR judgement | Safety | Mid Annual | Spread | OI | Vol |"
$lines += "|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|"

foreach ($a in $alerts) {
    $lines += "| $($a.Symbol) | $($a.Spot) | $($a.Expiry) | $($a.DTE) | $($a.Strike) | $($a.Mid) | $($a.BreakevenPrice) | $($a.EstimatedDelta) | $($a.WeeklyATR14) | $($a.StrikeAtrMultiple) | $($a.BreakevenAtrMultiple) | $($a.AtrSafetyJudgement) | $($a.SafetyPct)% | $($a.AnnualizedPct)% | $($a.SpreadPct)% | $($a.OpenInterest) | $($a.Volume) |"
}

if ($alerts.Count -eq 0) {
    $lines += ""
    $lines += "No contracts passed the alert filter."
}

$lines | Set-Content -LiteralPath $mdFile -Encoding UTF8

Write-Host "Wrote $($alerts.Count) alert rows:"
Write-Host "  $csvFile"
Write-Host "  $mdFile"

if ($alerts.Count -gt 0) {
    $alerts | Format-Table Symbol, Spot, Expiry, DTE, Strike, Mid, BreakevenPrice, EstimatedDelta, WeeklyATR14, BreakevenAtrMultiple, AtrSafetyJudgement -AutoSize
}
