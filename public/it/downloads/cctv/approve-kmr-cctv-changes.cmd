@echo off
rem After a wanted change (for example a new go2rtc.yaml with more cameras): approve the files, or the guard puts the old ones back within a minute. Asks the password.
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0kmr-cctv-protect.ps1" -Approve
