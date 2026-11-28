@echo off
rem KMR CCTV relay - one-time install. Put this file, kmr-cctv-relay.ps1, go2rtc.exe, go2rtc.yaml and cloudflared.exe in ONE folder and double-click this file (as administrator).
cd /d "%~dp0"
schtasks /Delete /TN "KMR CCTV Relay" /F >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /IM go2rtc.exe >nul 2>&1
schtasks /Create /TN "KMR CCTV Relay" /SC ONSTART /RU SYSTEM /RL HIGHEST /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0kmr-cctv-relay.ps1\""
schtasks /Run /TN "KMR CCTV Relay"
echo KMR CCTV relay installed. It runs hidden and starts by itself after every restart.
timeout /t 5 >nul
