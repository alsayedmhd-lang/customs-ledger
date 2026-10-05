param([string]$UserData = "$env:APPDATA\ledger")
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Stop.ps1') -UserData $UserData
$task = Get-ScheduledTask -TaskName 'Ledger Attachment Service' -ErrorAction SilentlyContinue
if ($task) { Unregister-ScheduledTask -InputObject $task -Confirm:$false }
Write-Host 'Automatic startup removed. Data and attachments were kept.'
