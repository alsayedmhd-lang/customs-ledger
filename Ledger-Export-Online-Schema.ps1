# Exports the live PostgreSQL public schema without data or credentials.
# Run with PowerShell on a machine with PostgreSQL client tools installed.
param(
  [Parameter(Mandatory = $true)][string]$Server,
  [int]$Port = 5432,
  [string]$Database = 'postgres',
  [Parameter(Mandatory = $true)][string]$Username,
  [string]$Output = (Join-Path (Get-Location) 'ledger-online-schema.sql')
)

$ErrorActionPreference = 'Stop'
$dump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $dump) {
  throw 'pg_dump is unavailable. Install PostgreSQL Command Line Tools and reopen PowerShell.'
}

$Output = [IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $Output) {
  throw "Output already exists: $Output. Choose another path to avoid overwriting it."
}

$secret = Read-Host 'PostgreSQL password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:PGSSLMODE = 'require'
  & $dump.Source --host $Server --port $Port --username $Username --dbname $Database `
    --schema public --schema-only --no-owner --no-privileges `
    --encoding UTF8 --file $Output
  if ($LASTEXITCODE -ne 0) {
    if (Test-Path -LiteralPath $Output) { Remove-Item -LiteralPath $Output -Force }
    throw "pg_dump failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$required = @('users','otp_codes','clients','invoices','invoice_items',
  'invoice_item_templates','invoice_accounting','receipts','customer_ledger',
  'invoice_audit_logs')
$sql = [IO.File]::ReadAllText($Output)
$missing = @($required | Where-Object {
  $pattern = '(?m)^CREATE TABLE (?:public\.)?' + [regex]::Escape($_) + '\s*\('
  $sql -notmatch $pattern
})
if ($missing.Count -gt 0) {
  Write-Warning ('Missing expected tables: ' + ($missing -join ', '))
} else {
  Write-Host 'Verified: all 10 expected Online tables are present.'
}
Write-Host "Schema saved: $Output"
Write-Host 'This file includes public schema objects only; it does not contain table records.'
