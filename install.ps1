# cline-fa-rtl — نصب‌کننده‌ی تک‌دستوری (بدون نیاز به git)
# Usage:
#   iwr -useb https://raw.githubusercontent.com/KhtaAi/CLine_Desktop_RTL/main/install.ps1 | iex
# Optional parameters (when dot-sourcing):
#   -Mode patch | unpatch | repatch
#   -Target desktop | extension | both
#   -ExePath "D:\path\to\cline-app.exe"

param(
  [string]$Mode = 'patch',
  [ValidateSet('desktop','extension','both')][string]$Target = 'both',
  [string]$ExePath = ''
)

$ErrorActionPreference = 'Stop'
$Repo  = 'KhtaAi/CLine_Desktop_RTL'
$Ref   = 'main'
$Dest  = Join-Path $env:LOCALAPPDATA 'cline-fa-rtl'

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# --- 1) Node.js ---
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Trying to install via winget...' -ForegroundColor Yellow
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required but was not found. Install it from https://nodejs.org (LTS) and re-run this command.'
  }
}
Write-Host "Node.js $(node --version) OK" -ForegroundColor Green

# --- 2) Download / update project ---
Write-Step "Project folder: $Dest"
if (Test-Path $Dest) {
  Write-Host 'Existing installation found -> updating...'
  Remove-Item $Dest -Recurse -Force
}
New-Item -ItemType Directory -Force $Dest | Out-Null

$zip = Join-Path $env:TEMP "cline-fa-rtl-$Ref.zip"
Invoke-WebRequest -Uri "https://codeload.github.com/$Repo/zip/refs/heads/$Ref" -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $env:TEMP -Force
$extracted = Get-ChildItem $env:TEMP -Directory -Filter 'CLine_Desktop_RTL-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item (Join-Path $extracted.FullName '*') $Dest -Recurse -Force
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $extracted.FullName -Recurse -Force -ErrorAction SilentlyContinue

# --- 3) Dependencies ---
Write-Step 'Installing dependencies (npm install --ignore-scripts)'
Push-Location $Dest
npm install --ignore-scripts --no-fund --no-audit --loglevel=error

# --- 4) Patch ---
if ($Mode -in 'patch','repatch') {
  if ($Target -in 'desktop','both') {
    Write-Step 'Patching Cline Desktop'
    if ($ExePath) { node bin\cline-desktop-rtl.js patch $ExePath } else { node bin\cline-desktop-rtl.js patch }
  }
  if ($Target -in 'extension','both') {
    Write-Step 'Patching Cline VS Code extension (if installed)'
    try { node bin\cline-fa-rtl.js patch } catch { Write-Host "Extension not found or skipped: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
} elseif ($Mode -eq 'unpatch') {
  if ($Target -in 'desktop','both') { node bin\cline-desktop-rtl.js unpatch }
  if ($Target -in 'extension','both') { try { node bin\cline-fa-rtl.js unpatch } catch {} }
}

Pop-Location
Write-Host "`n[DONE] Mode=$Mode Target=$Target" -ForegroundColor Green
Write-Host 'Restart Cline Desktop (and reload VS Code: Ctrl+Shift+P -> Developer: Reload Window).' -ForegroundColor Green
