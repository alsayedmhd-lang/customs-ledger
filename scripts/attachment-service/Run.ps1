$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime.json') -Raw | ConvertFrom-Json
$env:ELECTRON_RUN_AS_NODE = '1'
$log = Join-Path $PSScriptRoot 'service.log'
while ($true) {
    try {
        if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 2MB) {
            Move-Item -LiteralPath $log -Destination "$log.previous" -Force
        }
        & $config.exe (Join-Path $PSScriptRoot 'server.cjs') $config.userData $config.modulePath >> $log 2>&1
    } catch { Add-Content -LiteralPath $log -Value $_.Exception.Message }
    Start-Sleep -Seconds 5
}
