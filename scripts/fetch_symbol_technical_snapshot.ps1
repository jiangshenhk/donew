param(
    [Parameter(Mandatory = $true)]
    [string]$Symbol,
    [string]$OutDir = "",
    [string]$Range = "6mo",
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

function Get-Sma {
    param(
        [double[]]$Values,
        [int]$Length
    )

    if ($Values.Count -lt $Length) {
        return $null
    }

    return ($Values | Select-Object -Last $Length | Measure-Object -Average).Average
}

$normalizedSymbol = $Symbol.Trim().ToUpper()
$encodedSymbol = [uri]::EscapeDataString($normalizedSymbol)
$url = "https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?range=$Range&interval=$Interval"
$headers = @{
    "User-Agent" = "Mozilla/5.0"
    "Accept" = "application/json,text/plain,*/*"
}

$json = (Invoke-WebRequest -Uri $url -Headers $headers -UseBasicParsing -TimeoutSec 20).Content
$obj = $json | ConvertFrom-Json
$result = $obj.chart.result[0]
$quote = $result.indicators.quote[0]
$timestamps = @($result.timestamp)

$rows = @()
for ($i = 0; $i -lt $timestamps.Count; $i++) {
    if ($null -eq $quote.close[$i]) {
        continue
    }

    $dateTime = ([DateTimeOffset]::FromUnixTimeSeconds([int64]$timestamps[$i])).UtcDateTime
    $rows += [pscustomobject]@{
        Date = $dateTime.ToString("yyyy-MM-dd")
        Open = [math]::Round([double]$quote.open[$i], 4)
        High = [math]::Round([double]$quote.high[$i], 4)
        Low = [math]::Round([double]$quote.low[$i], 4)
        Close = [math]::Round([double]$quote.close[$i], 4)
        Volume = if ($null -ne $quote.volume[$i]) { [int64]$quote.volume[$i] } else { "" }
    }
}

if ($rows.Count -eq 0) {
    throw "No OHLCV rows returned for $normalizedSymbol"
}

$closes = [double[]]@($rows | ForEach-Object { [double]$_.Close })
$lastRow = $rows[-1]
$lastClose = [double]$lastRow.Close
$sma5 = Get-Sma -Values $closes -Length 5
$sma20 = Get-Sma -Values $closes -Length 20
$sma50 = Get-Sma -Values $closes -Length 50
$sma90 = Get-Sma -Values $closes -Length 90

$date = Get-Date -Format "yyyy-MM-dd"
$safeSymbol = $normalizedSymbol.Replace("^", "").Replace("=", "-").Replace("/", "-")
$csvFile = Join-Path $OutDir "technical_snapshot_${safeSymbol}_$date.csv"
$mdFile = Join-Path $OutDir "technical_snapshot_${safeSymbol}_$date.md"

$rows | Export-Csv -LiteralPath $csvFile -NoTypeInformation -Encoding UTF8

$summary = [pscustomobject]@{
    Symbol = $normalizedSymbol
    LastDate = $lastRow.Date
    LastClose = [math]::Round($lastClose, 4)
    SMA5 = if ($null -ne $sma5) { [math]::Round([double]$sma5, 4) } else { "" }
    VsSMA5Pct = if ($null -ne $sma5) { [math]::Round((($lastClose / [double]$sma5) - 1.0) * 100.0, 2) } else { "" }
    SMA20 = if ($null -ne $sma20) { [math]::Round([double]$sma20, 4) } else { "" }
    VsSMA20Pct = if ($null -ne $sma20) { [math]::Round((($lastClose / [double]$sma20) - 1.0) * 100.0, 2) } else { "" }
    SMA50 = if ($null -ne $sma50) { [math]::Round([double]$sma50, 4) } else { "" }
    VsSMA50Pct = if ($null -ne $sma50) { [math]::Round((($lastClose / [double]$sma50) - 1.0) * 100.0, 2) } else { "" }
    SMA90 = if ($null -ne $sma90) { [math]::Round([double]$sma90, 4) } else { "" }
    VsSMA90Pct = if ($null -ne $sma90) { [math]::Round((($lastClose / [double]$sma90) - 1.0) * 100.0, 2) } else { "" }
    Source = "Yahoo Finance chart"
    Range = $Range
    Interval = $Interval
    RetrievedAt = (Get-Date).ToString("s")
}

$recentRows = @($rows | Select-Object -Last 30)
$lines = @()
$lines += "# Technical Snapshot - $normalizedSymbol - $date"
$lines += ""
$lines += "> Menu 5 technical-only data. This file intentionally excludes option chains, Delta alerts, Barchart options overview, market news, and paper-trade writes."
$lines += ""
$lines += "## Summary"
$lines += ""
$lines += "| Symbol | LastDate | LastClose | SMA5 | Vs5% | SMA20 | Vs20% | SMA50 | Vs50% | SMA90 | Vs90% |"
$lines += "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
$lines += "| $($summary.Symbol) | $($summary.LastDate) | $($summary.LastClose) | $($summary.SMA5) | $($summary.VsSMA5Pct) | $($summary.SMA20) | $($summary.VsSMA20Pct) | $($summary.SMA50) | $($summary.VsSMA50Pct) | $($summary.SMA90) | $($summary.VsSMA90Pct) |"
$lines += ""
$lines += "## Recent OHLCV"
$lines += ""
$lines += "| Date | Open | High | Low | Close | Volume |"
$lines += "|---|---:|---:|---:|---:|---:|"

foreach ($row in $recentRows) {
    $lines += "| $($row.Date) | $($row.Open) | $($row.High) | $($row.Low) | $($row.Close) | $($row.Volume) |"
}

$lines | Set-Content -LiteralPath $mdFile -Encoding UTF8

Write-Host "Technical snapshot generated:"
Write-Host "  $csvFile"
Write-Host "  $mdFile"
$summary | Format-List
