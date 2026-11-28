# KMR CCTV relay - password protection and guard (Windows Server 2012 R2 and newer, PowerShell 4+). Used by the .cmd files next to it.
#   -Install   set the password (or ask it when re-installing), install the relay task and a guard task (needs administrator)
#   -Stop      stop the relay (asks the password). It starts again after a restart, or with install-kmr-cctv-relay.cmd
#   -Approve   approve changed files, for example a new go2rtc.yaml with more cameras (asks the password)
#   -Guard     run every minute as SYSTEM: puts back files changed without the password, switches the relay back on if it was disabled or ended
param([switch]$Install, [switch]$Stop, [switch]$Approve, [switch]$Guard)
$ErrorActionPreference = "Continue"
$G = Join-Path $env:ProgramFiles 'KMR\CctvGuard'
$self = Split-Path -Parent $MyInvocation.MyCommand.Path
$D = if ($self -ieq $G -and (Test-Path (Join-Path $G 'folder.txt'))) { ((Get-Content (Join-Path $G 'folder.txt')) | Out-String).Trim() } else { $self }
$LockFile = Join-Path $G 'lock.dat'; $Flag = Join-Path $D 'stopped.flag'; $Appr = Join-Path $G 'approved'; $Man = Join-Path $G 'approved.txt'
$Task = 'KMR CCTV Relay'; $GuardTask = 'KMR CCTV Guard'
function Note($m) { New-Item -ItemType Directory -Force $G | Out-Null; Add-Content (Join-Path $G 'guard.log') ((Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + ' ' + $m) }
function Ask-Secret($text) {
  Add-Type -AssemblyName System.Windows.Forms, System.Drawing
  $f = New-Object Windows.Forms.Form; $f.Text = 'KMR CCTV relay'; $f.Size = New-Object Drawing.Size(480, 180); $f.StartPosition = 'CenterScreen'; $f.TopMost = $true
  $l = New-Object Windows.Forms.Label; $l.Text = $text; $l.SetBounds(15, 12, 440, 35)
  $t = New-Object Windows.Forms.TextBox; $t.UseSystemPasswordChar = $true; $t.SetBounds(15, 52, 430, 25)
  $b = New-Object Windows.Forms.Button; $b.Text = 'OK'; $b.SetBounds(345, 92, 100, 30); $b.DialogResult = 'OK'; $f.AcceptButton = $b
  $f.Controls.AddRange(@($l, $t, $b))
  if ($f.ShowDialog() -eq 'OK') { $t.Text } else { $null }
}
function Get-LockHash($pw, $salt) { $sha = New-Object Security.Cryptography.SHA256Managed; $h = [Text.Encoding]::UTF8.GetBytes($salt + $pw); for ($i = 0; $i -lt 5000; $i++) { $h = $sha.ComputeHash($h) }; [Convert]::ToBase64String($h) }
function Msg($m) { Add-Type -AssemblyName System.Windows.Forms; [void][Windows.Forms.MessageBox]::Show($m, 'KMR CCTV relay') }
function Set-LockPassword {
  while ($true) {
    $a = Ask-Secret 'SET the password needed to stop, change or re-install the camera relay (at least 6 characters).'
    if ($null -eq $a) { return $false }
    if ($a.Length -lt 6) { Msg 'Use at least 6 characters.'; continue }
    if ($a -cne (Ask-Secret 'Type the same password again to confirm.')) { Msg 'The two did not match. Try again.'; continue }
    $salt = [Guid]::NewGuid().ToString('N'); New-Item -ItemType Directory -Force $G | Out-Null
    Set-Content -Path $LockFile -Value ($salt + '|' + (Get-LockHash $a $salt)); return $true
  }
}
function Test-LockPassword($why) {
  if (-not (Test-Path $LockFile)) { Msg 'No password has been set yet. Run install-kmr-cctv-relay.cmd first.'; return $false }
  $p = ((Get-Content $LockFile) | Out-String).Trim().Split('|')
  $pw = Ask-Secret ($why + ' Enter the camera relay password.')
  if ($null -eq $pw) { return $false }
  if ((Get-LockHash $pw $p[0]) -ceq $p[1]) { return $true }
  Msg 'Wrong password.'; $false
}
function Get-Files { 'kmr-cctv-relay.ps1', 'kmr-cctv-protect.ps1', 'go2rtc.yaml', 'go2rtc.exe', 'cloudflared.exe' | ForEach-Object { Join-Path $D $_ } | Where-Object { Test-Path $_ } }
function Approve-Now {
  New-Item -ItemType Directory -Force $Appr | Out-Null; $lines = @()
  foreach ($p in (Get-Files)) { $i = Get-Item $p; Copy-Item $p (Join-Path $Appr $i.Name) -Force; $lines += ($p + '|' + $i.Length + '|' + $i.LastWriteTimeUtc.Ticks + '|' + (Get-FileHash $p -Algorithm SHA256).Hash) }
  Set-Content $Man $lines; Note ('Files approved: ' + $lines.Count)
}
function Stop-Relay {
  Set-Content $Flag (Get-Date).ToString('s')
  & schtasks.exe /End /TN $Task 2>&1 | Out-Null
  Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'kmr-cctv-relay\.ps1' -or $_.Name -match '^(go2rtc|cloudflared)\.exe$' } | ForEach-Object { [void]$_.Terminate() }
}

if ($Install) {
  if (Test-Path $LockFile) { if (-not (Test-LockPassword 'Re-installing the camera relay.')) { 'Wrong or no password: nothing was changed.'; exit 1 } }
  elseif (-not (Set-LockPassword)) { 'No password chosen: nothing was installed.'; exit 1 }
  & schtasks.exe /End /TN $Task 2>&1 | Out-Null
  & schtasks.exe /Delete /TN $Task /F 2>&1 | Out-Null
  Get-WmiObject Win32_Process | Where-Object { $_.Name -match '^(go2rtc|cloudflared)\.exe$' } | ForEach-Object { [void]$_.Terminate() }
  & schtasks.exe /Create /TN $Task /SC ONSTART /RU SYSTEM /RL HIGHEST /F /TR ('powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"' + (Join-Path $D 'kmr-cctv-relay.ps1') + '\"') | Out-Null
  New-Item -ItemType Directory -Force $G | Out-Null
  Copy-Item (Join-Path $D 'kmr-cctv-protect.ps1') $G -Force; Set-Content (Join-Path $G 'folder.txt') $D
  & schtasks.exe /Create /TN $GuardTask /SC MINUTE /MO 1 /RU SYSTEM /RL HIGHEST /F /TR ('powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"' + (Join-Path $G 'kmr-cctv-protect.ps1') + '\" -Guard') | Out-Null
  Approve-Now
  Remove-Item $Flag -Force -ErrorAction SilentlyContinue
  & schtasks.exe /Run /TN $Task | Out-Null
  'KMR CCTV relay installed: it runs hidden, starts after every restart, and stopping, changing or re-installing it needs the password.'
  exit 0
}
if ($Stop) { if (Test-LockPassword 'Stopping the camera relay (the cameras cannot be seen in KMR CCTV).') { Stop-Relay; Msg 'Stopped. It starts again after a restart of this PC, or with install-kmr-cctv-relay.cmd.' }; exit 0 }
if ($Approve) { if (Test-LockPassword 'Approving the changed camera relay files.') { Approve-Now; Msg 'Approved.' }; exit 0 }
if ($Guard) {
  if (Test-Path $Man) {
    foreach ($line in (Get-Content $Man)) {
      $p = $line.Split('|'); $path = $p[0]; $copy = Join-Path $Appr ([IO.Path]::GetFileName($path)); if (-not (Test-Path $copy)) { continue }
      $bad = -not (Test-Path $path)
      if (-not $bad) { $i = Get-Item $path; if ($i.Length -ne [int64]$p[1] -or $i.LastWriteTimeUtc.Ticks -ne [int64]$p[2]) { $bad = ((Get-FileHash $path -Algorithm SHA256).Hash -ne $p[3]) } }
      if ($bad) {
        if ($path -match '\.exe$') { Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($path)) -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep 2 }
        try { Copy-Item $copy $path -Force; (Get-Item $path).LastWriteTimeUtc = (New-Object DateTime ([int64]$p[2]), ([DateTimeKind]::Utc)); Note ('Put back ' + $path + ' (changed without the password)') } catch { Note ('Could not put back ' + $path) }
      }
    }
  }
  $os = Get-WmiObject Win32_OperatingSystem
  if ((Test-Path $Flag) -and (Get-Item $Flag).LastWriteTime -gt $os.ConvertToDateTime($os.LastBootUpTime)) { exit 0 }
  $t = Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
  if (-not $t) { Note 'The relay task was DELETED. Run install-kmr-cctv-relay.cmd again.'; exit 1 }
  if (-not $t.Settings.Enabled) { Enable-ScheduledTask -TaskName $Task | Out-Null; Note 'The relay task had been disabled without the password: enabled again.' }
  if ("$((Get-ScheduledTask -TaskName $Task).State)" -ne 'Running') { Start-ScheduledTask -TaskName $Task; Note 'The relay was not running: started again.' }
}
