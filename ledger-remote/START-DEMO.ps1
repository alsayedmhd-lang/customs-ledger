$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 or later first.' }
node server.mjs
