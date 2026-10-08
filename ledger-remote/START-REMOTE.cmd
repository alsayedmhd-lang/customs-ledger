@echo off
title Ledger Remote Server
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START.ps1"
pause
