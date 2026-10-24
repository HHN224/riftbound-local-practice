@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0community\Start-Local.ps1"
if errorlevel 1 pause
