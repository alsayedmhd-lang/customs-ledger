Set WshShell = CreateObject("WScript.Shell")

projectPath = "D:\customs-ledger - Local-SQL"

WshShell.Run "cmd /c cd /d """ & projectPath & """ && set PORT=3000 && pnpm --filter api-server dev", 0, False
WScript.Sleep 4000

WshShell.Run "cmd /c cd /d """ & projectPath & """ && set PORT=4174 && set BASE_PATH=/ && pnpm --filter customs-accounting dev", 0, False
WScript.Sleep 6000

WshShell.Run "http://localhost:4174", 1, False

Set WshShell = Nothing