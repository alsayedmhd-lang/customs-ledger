$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path '.env')) { throw 'Missing .env. Keep your existing connection settings.' }
$certs = @(Get-ChildItem -File | Where-Object { $_.Name -like 'prod-ca-2021*' -or $_.Name -eq 'supabase-ca.crt' })
if ($certs.Count -gt 1) { throw 'Keep one matching CA certificate or configure NODE_EXTRA_CA_CERTS yourself.' }
if ($certs.Count -eq 1) { $env:NODE_EXTRA_CA_CERTS = $certs[0].FullName }
node --env-file=.env server.mjs
if ($LASTEXITCODE -ne 0) { throw 'Server failed. Review the error above.' }
