@echo off
rem KMR CCTV relay - one-time install. Put this file, kmr-cctv-relay.ps1, kmr-cctv-protect.ps1, go2rtc.exe, go2rtc.yaml and cloudflared.exe in ONE folder and double-click this file.
rem Windows asks for administrator rights once. You choose a password: it is needed to stop, change or re-install the relay.
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0kmr-cctv-protect.ps1" -Install
echo.
pause
