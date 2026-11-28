@echo off
rem Stops the KMR CCTV relay (asks the password). It starts again after a restart, or with install-kmr-cctv-relay.cmd.
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0kmr-cctv-protect.ps1" -Stop
