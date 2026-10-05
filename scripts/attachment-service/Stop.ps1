param([string]$UserData = "$env:APPDATA\ledger")
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName 'Ledger Attachment Service' -ErrorAction SilentlyContinue
if ($task) { Stop-ScheduledTask -InputObject $task }
$server = Join-Path $UserData 'attachment-service\server.cjs'
$runner = Join-Path $UserData 'attachment-service\Run.ps1'
# Stop only this user's service processes, never the regular Ledger backend.
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and ($_.CommandLine.Contains($server) -or $_.CommandLine.Contains($runner))
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host 'Attachment service stopped.'
