@echo off
setlocal EnableDelayedExpansion

set PROJECT_DIR="D:\customs-ledger - Local-SQL"

echo Starting backend...
start /min cmd /c "cd /d %PROJECT_DIR% && set PORT=3000 && pnpm --filter api-server dev"

timeout /t 4 >nul

echo Starting frontend...
start /min cmd /c "cd /d %PROJECT_DIR% && set PORT=4174 && set BASE_PATH=/ && pnpm --filter customs-accounting dev"

timeout /t 6 >nul

echo Opening project...
start http://localhost:4174

exit