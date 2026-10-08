$ErrorActionPreference='Stop'
Get-ScheduledTask -TaskName 'Ledger Remote' | Select-Object TaskName,State
Get-ScheduledTaskInfo -TaskName 'Ledger Remote' | Select-Object LastRunTime,LastTaskResult
Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess
