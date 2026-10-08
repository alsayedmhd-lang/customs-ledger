$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$certs = @(Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object { $_.Name -like 'prod-ca-2021*' -or $_.Name -eq 'supabase-ca.crt' })
if ($certs.Count -eq 1) { $env:NODE_EXTRA_CA_CERTS = $certs[0].FullName }
node --env-file=.env PREPARE-ONLINE.mjs
if ($LASTEXITCODE -ne 0) { throw 'Online schema preparation failed.' }
