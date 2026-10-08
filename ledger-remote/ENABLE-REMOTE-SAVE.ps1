$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'PREPARE-ONLINE.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Preparation failed. Saving was not enabled.' }
$path = Join-Path $PSScriptRoot '.env'
Copy-Item -LiteralPath $path -Destination ($path + '.backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$lines = @([IO.File]::ReadAllLines($path) | Where-Object { $_ -notmatch '^\s*REMOTE_WRITE_ENABLED\s*=' })
$lines += 'REMOTE_WRITE_ENABLED=1'
[IO.File]::WriteAllLines($path, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Remote draft saving enabled. Restart Remote. Drafts reach Ledger Desktop through Online sync.'
