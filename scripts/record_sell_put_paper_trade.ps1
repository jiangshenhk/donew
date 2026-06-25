param(
    [string]$AlertCsvFile,
    [string]$PaperBookFile = "",
    [int]$Quantity = 1
)

$ErrorActionPreference = "Stop"

if (-not $AlertCsvFile -or -not (Test-Path -LiteralPath $AlertCsvFile)) {
    Write-Host "No alert CSV found. Paper trade skipped."
    return
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRootDir = (Resolve-Path (Join-Path $scriptDir "..")).Path

if (-not $PaperBookFile) {
    $paperBookName = "$([char]0x6A21)$([char]0x62DF)$([char]0x76D8).md"
    $PaperBookFile = Join-Path (Join-Path $repoRootDir "docs\SellPut") $paperBookName
}

if (-not (Test-Path -LiteralPath $PaperBookFile)) {
    throw "Paper book file not found: $PaperBookFile"
}

function To-DoubleOrZero {
    param([object]$Value)

    if ($null -eq $Value -or ([string]$Value).Trim() -eq "") {
        return 0.0
    }

    return [double]$Value
}

$alerts = @(Import-Csv -LiteralPath $AlertCsvFile)
if ($alerts.Count -eq 0) {
    Write-Host "No alert rows. Paper trade skipped."
    return
}

$candidate = $alerts |
    Sort-Object `
        @{ Expression = { [math]::Abs((To-DoubleOrZero $_.AbsDelta) - 0.15) }; Ascending = $true },
        @{ Expression = { To-DoubleOrZero $_.SafetyPct }; Ascending = $false },
        @{ Expression = { To-DoubleOrZero $_.AnnualizedPct }; Ascending = $false } |
    Select-Object -First 1

$date = Get-Date -Format "yyyy-MM-dd"
$symbol = ([string]$candidate.Symbol).ToUpper()
$expiry = [string]$candidate.Expiry
$strike = [string]$candidate.Strike
$contract = "$expiry ${strike}P"
$uniqueKey = "| {0} | {1} | {2} |" -f $date, $symbol, $contract
$paperText = Get-Content -LiteralPath $PaperBookFile -Raw -Encoding UTF8

if ($paperText.Contains($uniqueKey)) {
    Write-Host "Paper trade already exists for $date $symbol $contract. Skipped."
    return
}

$mid = To-DoubleOrZero $candidate.Mid
$spot = To-DoubleOrZero $candidate.Spot
$delta = To-DoubleOrZero $candidate.EstimatedDelta
$safety = To-DoubleOrZero $candidate.SafetyPct
$annualized = To-DoubleOrZero $candidate.AnnualizedPct
$collateral = [math]::Round((To-DoubleOrZero $strike) * 100 * $Quantity, 2)

$note = "auto alert candidate; simulated fill uses Mid; confirm real Delta, bid/ask and technical structure in Futu before any real trade"
$row = "| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7}% | {8}% | {9} | Open | {10} |" -f $date, $symbol, $contract, $Quantity, $mid, $spot, $delta, $safety, $annualized, $collateral, $note

$marker = "<!-- PAPER_TRADE_INSERT_BEFORE -->"
if (-not $paperText.Contains($marker)) {
    throw "Paper book marker not found: $marker"
}

$updated = $paperText.Replace("`r`n$marker", "`r`n$row`r`n`r`n$marker")
if ($updated -eq $paperText) {
    $updated = $paperText.Replace("`n$marker", "`n$row`n`n$marker")
}

Set-Content -LiteralPath $PaperBookFile -Value $updated -Encoding UTF8
Write-Host "Paper trade recorded: $symbol $contract x$Quantity @ $mid"
