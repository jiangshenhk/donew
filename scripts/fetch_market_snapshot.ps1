param(
    [string]$Symbols = "QQQ,SPY,IWM,QLD,TQQQ,SMH,SOXX,MAGS,EEM,FXI,KWEB,^VIX,VIXY,IBIT,BTC-USD,MSTR,DX-Y.NYB,^TNX,JPY=X,CL=F,GC=F",
    [string]$OutDir = "",
    [string]$Range = "3mo",
    [string]$Interval = "1d"
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $workspaceDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
    $OutDir = Join-Path $workspaceDir "outputs"
}

if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

function Get-NumberOrNull {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $text = ([string]$Value).Trim()
    if ($text -eq "" -or $text -eq "null") {
        return $null
    }

    $out = 0.0
    if ([double]::TryParse($text, [ref]$out)) {
        return $out
    }

    return $null
}

function Get-MarketRow {
    param([string]$Symbol)

    $encodedSymbol = [uri]::EscapeDataString($Symbol)
    $url = "https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=$Range&interval=$Interval"
    $headers = @{
        "User-Agent" = "Mozilla/5.0"
        "Accept" = "application/json,text/plain,*/*"
    }

    try {
        $json = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 20).Content
        $obj = $json | ConvertFrom-Json
        $result = $obj.chart.result[0]
        $quotes = @($result.indicators.quote[0].close | Where-Object { $null -ne $_ })

        if ($quotes.Count -eq 0) {
            throw "No close data returned"
        }

        $last = Get-NumberOrNull $result.meta.regularMarketPrice
        if ($null -eq $last -or $last -le 0) {
            $last = [double]$quotes[-1]
        }

        $sma20 = ($quotes | Select-Object -Last 20 | Measure-Object -Average).Average
        $sma50 = ($quotes | Select-Object -Last 50 | Measure-Object -Average).Average

        return [pscustomobject]@{
            Symbol = $Symbol
            Last = [math]::Round([double]$last, 4)
            SMA20 = [math]::Round([double]$sma20, 4)
            Vs20Pct = [math]::Round((([double]$last / [double]$sma20) - 1.0) * 100.0, 2)
            SMA50 = [math]::Round([double]$sma50, 4)
            Vs50Pct = [math]::Round((([double]$last / [double]$sma50) - 1.0) * 100.0, 2)
            Currency = $result.meta.currency
            Exchange = $result.meta.exchangeName
            Range = $Range
            Interval = $Interval
            Source = "Yahoo Finance chart"
            RetrievedAt = (Get-Date).ToString("s")
            Error = ""
        }
    }
    catch {
        return [pscustomobject]@{
            Symbol = $Symbol
            Last = ""
            SMA20 = ""
            Vs20Pct = ""
            SMA50 = ""
            Vs50Pct = ""
            Currency = ""
            Exchange = ""
            Range = $Range
            Interval = $Interval
            Source = "Yahoo Finance chart"
            RetrievedAt = (Get-Date).ToString("s")
            Error = $_.Exception.Message
        }
    }
}

$date = Get-Date -Format "yyyy-MM-dd"
$csvFile = Join-Path $OutDir "market_snapshot_$date.csv"
$mdFile = Join-Path $OutDir "market_snapshot_$date.md"

$symbolList = $Symbols.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$rows = foreach ($symbol in $symbolList) {
    Get-MarketRow -Symbol $symbol
}

$rows | Export-Csv -LiteralPath $csvFile -NoTypeInformation -Encoding UTF8

$lines = @()
$lines += "# Market Snapshot - $date"
$lines += ""
$lines += "> Menu 6 market-only data. This file intentionally excludes option chains, Delta alerts, Barchart options overview, and paper-trade writes."
$lines += ""
$lines += "| Symbol | Last | SMA20 | Vs20% | SMA50 | Vs50% | Source | RetrievedAt | Error |"
$lines += "|---|---:|---:|---:|---:|---:|---|---|---|"

foreach ($row in $rows) {
    $errorText = ([string]$row.Error).Replace("|", "/")
    $lines += "| $($row.Symbol) | $($row.Last) | $($row.SMA20) | $($row.Vs20Pct) | $($row.SMA50) | $($row.Vs50Pct) | $($row.Source) | $($row.RetrievedAt) | $errorText |"
}

$lines | Set-Content -LiteralPath $mdFile -Encoding UTF8

Write-Host "Market snapshot generated:"
Write-Host "  $csvFile"
Write-Host "  $mdFile"
$rows | Format-Table -AutoSize
