# KMR CCTV relay watchdog (Windows Server 2012 R2 and newer, PowerShell 4+). Runs hidden at start-up (scheduled task "KMR CCTV Relay").
# Keeps go2rtc and the Cloudflare tunnel running, checks the PUBLIC tunnel address every minute (not only the local process),
# restarts the tunnel when the address stops answering, and reports the address + a heartbeat to KMR every 5 minutes.
$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$D = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG = Join-Path $D "kmr-cctv-relay.log"; $CFLOG = Join-Path $D "cloudflared.log"
$SB = "https://dehlcusptkzfhqvpfyjh.supabase.co/rest/v1/rpc/kmr_cctv_relay_report"; $KEY = "sb_publishable_ukWZLiTOXfUZsNAyn5BM7Q_YjSFcUus"
function Log($m) { $l = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $m; Add-Content -Path $LOG -Value $l; if ((Get-Item $LOG).Length -gt 2MB) { Move-Item $LOG ($LOG + ".old") -Force } }
$yaml = Get-Content (Join-Path $D "go2rtc.yaml") -Raw
$SECRET = ([regex]::Match($yaml, 'base_path:\s*"?/([0-9a-f]{32,})')).Groups[1].Value
if (-not $SECRET) { Log "go2rtc.yaml has no base_path secret - stopping"; exit 1 }
$GO = Join-Path $D "go2rtc.exe"; $CF = Join-Path $D "cloudflared.exe"
if (-not (Test-Path $CF)) { $c = Get-Command cloudflared.exe -ErrorAction SilentlyContinue; if ($c) { $CF = $c.Path } }

function Ok($u) { try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 20; return ($r.StatusCode -eq 200) } catch { return $false } }
function Procs($exe) { Get-WmiObject Win32_Process | Where-Object { $_.ExecutablePath -and ($_.ExecutablePath -ieq $exe) } }
function StartGo { Procs $GO | ForEach-Object { $_.Terminate() | Out-Null }; Start-Process -FilePath $GO -ArgumentList "-config `"$(Join-Path $D 'go2rtc.yaml')`"" -WorkingDirectory $D -WindowStyle Hidden; Log "go2rtc started"; Start-Sleep 5 }
function StartCf {
  Get-WmiObject Win32_Process -Filter "Name='cloudflared.exe'" | ForEach-Object { $_.Terminate() | Out-Null }
  Start-Sleep 2; if (Test-Path $CFLOG) { Remove-Item $CFLOG -Force -ErrorAction SilentlyContinue }
  Start-Process -FilePath $CF -ArgumentList "tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:1984 --logfile `"$CFLOG`"" -WorkingDirectory $D -WindowStyle Hidden
  Log "tunnel started"
  for ($i = 0; $i -lt 45; $i++) { Start-Sleep 2; if (Test-Path $CFLOG) { $m = [regex]::Match((Get-Content $CFLOG -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { return $m.Value } } }
  return $null
}
function Report($u, $note) {
  try { $b = @{ p_secret = $SECRET; p_url = $u; p_note = $note } | ConvertTo-Json
    Invoke-RestMethod -Uri $SB -Method Post -Body $b -ContentType "application/json" -Headers @{ apikey = $KEY; Authorization = "Bearer $KEY" } -TimeoutSec 20 | Out-Null; return $true } catch { Log ("report failed: " + $_.Exception.Message); return $false }
}

Log "watchdog started"
$URL = $null; $fails = 0; $lastRep = [datetime]::MinValue; $started = Get-Date
while ($true) {
  if (-not (Ok "http://127.0.0.1:1984/$SECRET/api/streams")) { Log "go2rtc not answering - restarting"; StartGo }
  if (-not $URL -or -not (Procs $CF)) { $URL = StartCf; $fails = 0; $started = Get-Date; if ($URL) { Log "address $URL"; Start-Sleep 20; Report $URL "tunnel (re)started" | Out-Null; $lastRep = Get-Date } else { Log "tunnel gave no address - retry in 30 s"; Start-Sleep 30; continue } }
  if (Ok "$URL/$SECRET/api/streams") { $fails = 0 }
  elseif (((Get-Date) - $started).TotalSeconds -gt 90) { $fails++; Log "public address not answering ($fails)"; if ($fails -ge 3) { Log "restarting tunnel"; $URL = $null; continue } }
  if (((Get-Date) - $lastRep).TotalMinutes -ge 5) { if (Report $URL ("ok " + $env:COMPUTERNAME)) { $lastRep = Get-Date } }
  Start-Sleep 60
}
