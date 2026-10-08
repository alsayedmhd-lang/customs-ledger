param([string]$LedgerExe = "$env:LOCALAPPDATA\Programs\Ledger\Ledger.exe")
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (!(Test-Path -LiteralPath $LedgerExe)) { throw 'Ledger.exe not found. Pass -LedgerExe with its installed path.' }
$native = Join-Path (Split-Path $LedgerExe) 'resources\api-server\node_modules\better-sqlite3'
if (!(Test-Path -LiteralPath $native)) { throw 'Installed SQLite module not found.' }
Add-Type -AssemblyName System.Windows.Forms
$picker = New-Object System.Windows.Forms.OpenFileDialog
$picker.Title = 'Select the current Ledger SQLite database (read only)'
$picker.Filter = 'SQLite database (*.db)|*.db|All files (*.*)|*.*'
if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
$dbFile = $picker.FileName
$temporary = Join-Path $PSScriptRoot ('export-print-' + [Guid]::NewGuid().ToString('N') + '.cjs')
$output = Join-Path $PSScriptRoot 'print-settings.json'
$stdoutLog = $temporary + '.stdout.log'
$stderrLog = $temporary + '.stderr.log'
$previous = $env:ELECTRON_RUN_AS_NODE
$code = @'
const fs=require('fs');
const [native,dbFile,output]=process.argv.slice(2);
const Database=require(native),db=new Database(dbFile,{readonly:true,fileMustExist:true});
const keys=['name_ar','name_en','subtitle_ar','subtitle_en','tagline_ar','tagline_en','email','phone','address','po_box','website','cr_number','tax_number','logo_base64','stamp_base64','watermark_base64','show_watermark','show_stamp_on_invoices','footer_text','invoice_cash_title_ar','invoice_cash_title_en','invoice_credit_title_ar','invoice_credit_title_en','invoice_title_font_size','invoice_title_en_font_size','invoice_title_visible','invoice_title_align','invoice_title_bold','invoice_subtitle_ar','invoice_subtitle_en','invoice_subtitle_font_size','logo_size','logo_height','accountant_signature_base64','receiver_signature_base64','show_accountant_signature','show_receiver_signature'];
try{const columns=db.prepare('PRAGMA table_info(company_settings)').all().map(c=>c.name);const allowed=keys.filter(k=>columns.includes(k));if(!allowed.length)throw Error('No print settings found');const row=db.prepare('SELECT '+allowed.map(k=>'"'+k+'"').join(',')+' FROM company_settings ORDER BY id LIMIT 1').get();if(!row)throw Error('Empty company settings');const data=JSON.stringify(row,null,2);if(fs.existsSync(output))fs.copyFileSync(output,output+'.backup-'+Date.now());fs.writeFileSync(output+'.tmp',data,'utf8');fs.renameSync(output+'.tmp',output);console.log('Print settings exported. No database changes.');}finally{db.close();}
'@
try {
    [IO.File]::WriteAllText($temporary,$code,(New-Object System.Text.UTF8Encoding($false)))
    $env:ELECTRON_RUN_AS_NODE = '1'
    $arguments = @($temporary, $native, $dbFile, $output) | ForEach-Object { '"' + $_ + '"' }
    $process = Start-Process -FilePath $LedgerExe -ArgumentList $arguments -Wait -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    if (Test-Path -LiteralPath $stdoutLog) { Get-Content -LiteralPath $stdoutLog | Write-Host }
    if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog | Write-Host }
    if ($process.ExitCode -ne 0) { throw ('Print settings export failed. Exit code: ' + $process.ExitCode) }
    if (!(Test-Path -LiteralPath $output)) { throw 'Export file not found.' }
    Write-Host "Saved: $output"
    Write-Host 'Refresh the Remote invoice print preview.'
} finally {
    $env:ELECTRON_RUN_AS_NODE = $previous
    Remove-Item -LiteralPath $temporary, $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
    $picker.Dispose()
}
