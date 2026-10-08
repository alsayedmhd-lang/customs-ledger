$ErrorActionPreference='Stop'
try {
 Set-Location $PSScriptRoot
 if (!(Test-Path -LiteralPath '.env')) { throw 'Missing .env' }
 $node=(Get-Command node.exe -ErrorAction Stop).Source
 $certs=@(Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object { $_.Name -like 'prod-ca-2021*' -or $_.Name -eq 'supabase-ca.crt' })
 if ($certs.Count -gt 1) { throw 'Keep one CA certificate or configure NODE_EXTRA_CA_CERTS.' }
 if ($certs.Count -eq 1) { $env:NODE_EXTRA_CA_CERTS=$certs[0].FullName }
 $logs=Join-Path $PSScriptRoot 'logs'
 New-Item -ItemType Directory -Path $logs -Force | Out-Null
 $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
 $process=Start-Process -FilePath $node -ArgumentList @('--env-file=.env','server.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logs "remote-$stamp.out.log") -RedirectStandardError (Join-Path $logs "remote-$stamp.err.log")
 exit $process.ExitCode
} catch { Write-Error $_; exit 1 }
