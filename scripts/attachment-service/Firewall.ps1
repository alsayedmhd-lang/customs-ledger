param([Parameter(Mandatory=$true)][string[]]$PeerIP)
$ErrorActionPreference = 'Stop'
foreach ($ip in $PeerIP) {
    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($ip, [ref]$parsed) -or $parsed.AddressFamily -ne 'InterNetwork') { throw "Invalid IPv4: $ip" }
    $parts = $parsed.GetAddressBytes()
    $private = $parts[0] -eq 10 -or ($parts[0] -eq 192 -and $parts[1] -eq 168) -or ($parts[0] -eq 172 -and $parts[1] -ge 16 -and $parts[1] -le 31) -or ($parts[0] -eq 100 -and $parts[1] -ge 64 -and $parts[1] -le 127)
    if (-not $private) { throw 'Only private LAN or NetBird peer addresses are allowed.' }
}
$ruleName = 'Ledger-Attachment-Service-3001'
Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -Name $ruleName -DisplayName 'Ledger trusted peer attachments' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -RemoteAddress $PeerIP -Profile Any | Out-Null
Write-Host 'Port 3001 allowed only for the supplied peer IP addresses.'
