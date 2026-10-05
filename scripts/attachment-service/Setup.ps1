param(
    [string]$LedgerExe = "$env:LOCALAPPDATA\Programs\Ledger\Ledger.exe",
    [string]$UserData = "$env:APPDATA\ledger"
)
$ErrorActionPreference = 'Stop'
$LedgerExe = (Resolve-Path -LiteralPath $LedgerExe).Path
$UserData = (Resolve-Path -LiteralPath $UserData).Path
$modulePath = Join-Path (Split-Path $LedgerExe) 'resources\api-server\node_modules\better-sqlite3'
foreach ($file in @('device-identity.json', 'trusted-devices.json', 'storage-config.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $UserData $file))) { throw "Missing $file in $UserData. Open Ledger and pair devices first." }
}
if (-not (Test-Path -LiteralPath $modulePath)) { throw 'Select the installed Ledger.exe or release\win-unpacked\Ledger.exe.' }
# Verify the existing Electron native module before registering background startup.
$previousRunAsNode = $env:ELECTRON_RUN_AS_NODE
try {
    $env:ELECTRON_RUN_AS_NODE = '1'
    $probe = Start-Process -FilePath $LedgerExe -ArgumentList @("-e", "require(process.argv[1])", ('"' + $modulePath + '"')) -Wait -PassThru -NoNewWindow
    if ($probe.ExitCode -ne 0) { throw 'Ledger native SQLite module could not be loaded.' }
} finally { $env:ELECTRON_RUN_AS_NODE = $previousRunAsNode }
$taskName = 'Ledger Attachment Service'
& (Join-Path $PSScriptRoot 'Stop.ps1') -UserData $UserData
$target = Join-Path $UserData 'attachment-service'
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($file in @('server.cjs', 'Run.ps1', 'Stop.ps1', 'Remove.ps1')) {
    if ((Join-Path $PSScriptRoot $file) -ne (Join-Path $target $file)) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $target $file) -Force
    }
}
@{ exe = $LedgerExe; userData = $UserData; modulePath = $modulePath } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'runtime.json') -Encoding UTF8
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$target\Run.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host 'Background attachment service installed and started on port 3001.'
Write-Host "Log: $target\service.log"
Write-Host 'Starts after this Windows user logs in. No firewall rules were changed.'
