param([string]$LanIp='')
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$taskName='Ledger Remote'
$ruleName='LedgerRemote-Office-LAN'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run PowerShell as Administrator using your normal Windows account.' }
if (!(Test-Path -LiteralPath (Join-Path $root '.env'))) { throw 'Missing existing .env. Keep your Online connection settings.' }
$node=(Get-Command node.exe -ErrorAction Stop).Source
if (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3080 is in use. Stop Remote with Ctrl+C before setup.' }
if (!$LanIp) {
 $physical=@(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface } | Select-Object -ExpandProperty ifIndex)
 $candidates=@(Get-NetIPConfiguration | Where-Object { $_.InterfaceIndex -in $physical -and $_.IPv4DefaultGateway -and $_.IPv4Address })
 if ($candidates.Count -ne 1) { throw 'More than one office adapter, or no office adapter found. Run again with -LanIp and the office IPv4 address.' }
 $LanIp=[string]$candidates[0].IPv4Address[0].IPAddress
}
$address=$null
if (![Net.IPAddress]::TryParse($LanIp,[ref]$address) -or $address.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $LanIp -match '^(127\.|169\.254\.|0\.)') { throw 'Choose a valid office IPv4 address.' }
$assigned=@(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LanIp -ErrorAction SilentlyContinue)
if ($assigned.Count -ne 1) { throw 'This IPv4 address is not uniquely assigned to this PC.' }
$profile=Get-NetConnectionProfile -InterfaceIndex $assigned[0].InterfaceIndex -ErrorAction Stop
if ($profile.NetworkCategory -ne 'Private') { throw 'Set the trusted office connection to Private in Windows network settings, then run again.' }
$envPath=Join-Path $root '.env'
$text=[IO.File]::ReadAllText($envPath)
if ($text -notmatch '(?m)^\s*DATABASE_URL\s*=\s*\S+') { throw 'Online DATABASE_URL is required. Demo cannot be shared on LAN.' }
$url="http://${LanIp}:3080"
$backup=Join-Path $root ('update-backups\lan-autostart-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item -LiteralPath $envPath -Destination (Join-Path $backup '.env')
$oldTask=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$oldXml=if($oldTask){Export-ScheduledTask -TaskName $taskName}else{$null}
if($oldXml){[IO.File]::WriteAllText((Join-Path $backup 'task.xml'),$oldXml)}
$oldRule=Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
if($oldRule){throw 'A previous Ledger LAN firewall rule exists. Review it before replacing the setup.'}
$logs=Join-Path $root 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$acl=Get-Acl -LiteralPath $logs
$logRule=New-Object Security.AccessControl.FileSystemAccessRule($identity.User,'Modify','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($logRule)
Set-Acl -LiteralPath $logs -AclObject $acl
$createdRule=$false;$registered=$false
try {
 foreach($setting in @(@('HOST',$LanIp),@('PORT','3080'),@('APP_ORIGIN',$url))) {
  $pattern='(?m)^\s*'+$setting[0]+'\s*=.*$'
  $line=$setting[0]+'='+$setting[1]
  if([regex]::IsMatch($text,$pattern)){$text=[regex]::Replace($text,$pattern,$line)}else{$text=$text.TrimEnd()+"`r`n"+$line+"`r`n"}
 }
 $utf8=New-Object Text.UTF8Encoding($false)
 [IO.File]::WriteAllText($envPath,$text,$utf8)
 New-NetFirewallRule -Name $ruleName -DisplayName 'Ledger Remote - office network only' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3080 -LocalAddress $LanIp -RemoteAddress LocalSubnet -Profile Private -Program $node | Out-Null
 $createdRule=$true
 $powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 $arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+(Join-Path $root 'RUN-BACKGROUND.ps1')+'"'
 $action=New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $root
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
 $taskPrincipal=New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
 Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Force | Out-Null
 $registered=$true
 Start-ScheduledTask -TaskName $taskName
 $ready=$false
 for($n=0;$n -lt 20;$n++) {
  Start-Sleep -Milliseconds 500
  try { $response=Invoke-WebRequest -Uri ($url+'/favicon.ico') -UseBasicParsing -TimeoutSec 1;if($response.StatusCode -eq 200){$ready=$true;break} } catch {}
 }
 if(!$ready){throw 'Remote did not start. Review logs in the project logs folder.'}
 & (Join-Path $root 'CREATE-DESKTOP-SHORTCUT.ps1') -RemoteUrl $url
 Write-Host 'Remote starts automatically when this Windows user signs in.'
 Write-Host "Open this link on the second office device: $url"
 Write-Host "Configuration backup: $backup"
 Write-Host 'Keep this office IPv4 address reserved so the link remains stable.'
} catch {
 if($registered){Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue;Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue}
 if($oldXml){Register-ScheduledTask -TaskName $taskName -Xml $oldXml -Force | Out-Null}
 if($createdRule){Remove-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue}
 Copy-Item -LiteralPath (Join-Path $backup '.env') -Destination $envPath -Force
 throw
}
