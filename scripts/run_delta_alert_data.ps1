param(
    [string]$Symbols = "QLD,EEM,TQQQ,GDX,ARKK,IBIT,SOFI,RIVN,SMCI,INTC,MSTR,MARA,RIOT,IONQ,HOOD,PLTR",
    [int]$OptionChainLimit = 300,
    [string]$OutDir = "outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRootDir = (Resolve-Path (Join-Path $scriptDir "..")).Path
$workspaceDir = (Resolve-Path (Join-Path $repoRootDir "..")).Path
$sharedScriptDir = Join-Path $workspaceDir "scripts"
$resolvedOutDir = Join-Path $workspaceDir $OutDir

if (-not (Test-Path -LiteralPath $resolvedOutDir)) {
    New-Item -ItemType Directory -Path $resolvedOutDir | Out-Null
}

Push-Location $workspaceDir
try {
    & (Join-Path $sharedScriptDir "fetch_barchart_options_overview.ps1") -Symbols $Symbols -OutDir $OutDir
    & (Join-Path $sharedScriptDir "fetch_nasdaq_put_chain.ps1") -Symbols $Symbols -Limit $OptionChainLimit -OutDir $OutDir
}
finally {
    Pop-Location
}

$date = Get-Date -Format "yyyy-MM-dd"
$chainFile = Join-Path $resolvedOutDir "nasdaq_put_chain_$date.csv"
$overviewFile = Join-Path $resolvedOutDir "barchart_options_overview_$date.csv"

& (Join-Path $repoRootDir "scripts\scan_sell_put_alerts.ps1") -Symbols $Symbols -OutDir $resolvedOutDir -ChainFile $chainFile -OverviewFile $overviewFile

Write-Host "Delta alert data generated:"
Write-Host "  $overviewFile"
Write-Host "  $chainFile"
Write-Host "  $(Join-Path $resolvedOutDir "sell_put_delta_alerts_$date.csv")"
Write-Host "  $(Join-Path $resolvedOutDir "sell_put_delta_alerts_$date.md")"
