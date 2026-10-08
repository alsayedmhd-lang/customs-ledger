param([string]$RemoteUrl="http://localhost:3080")
$ErrorActionPreference="Stop"
$uri=$null
if (-not [Uri]::TryCreate($RemoteUrl,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -notin @("http","https") -or $RemoteUrl.Contains("`r") -or $RemoteUrl.Contains("`n")) { throw "Enter a valid http/https Remote URL." }
$source=Join-Path $PSScriptRoot "public\icons\ledger-remote.ico"
if (-not (Test-Path -LiteralPath $source)) { $source=Join-Path $PSScriptRoot "ledger-remote.ico" }
$folder=Join-Path $env:LOCALAPPDATA "LedgerRemote"
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$icon=Join-Path $folder "ledger-remote.ico"
Copy-Item -LiteralPath $source -Destination $icon -Force
$desktop=[Environment]::GetFolderPath("Desktop")
$shortcut=Join-Path $desktop "Ledger Remote.url"
$content="[InternetShortcut]`r`nURL=$RemoteUrl`r`nIconFile=$icon`r`nIconIndex=0`r`n"
[IO.File]::WriteAllText($shortcut,$content,[Text.Encoding]::Unicode)
Write-Host "Desktop shortcut created: $shortcut"
Write-Host "Remote URL: $RemoteUrl"
