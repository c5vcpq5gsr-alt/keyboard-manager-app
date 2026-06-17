param(
  [string]$PreviousInstaller
)

$ErrorActionPreference = "Stop"

$installer = Get-ChildItem -Path "dist" -Filter "*Setup*.exe" | Select-Object -First 1
if (-not $installer) {
  throw "Windows installer not found"
}

$userData = Join-Path $env:APPDATA "Keyboard Manager"
$marker = Join-Path $userData "installer-update-test.txt"

if ($PreviousInstaller) {
  Start-Process -FilePath $PreviousInstaller -ArgumentList "/S" -Wait
}

New-Item -ItemType Directory -Path $userData -Force | Out-Null
Set-Content -Path $marker -Value "must survive updates"

Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait

$installedApp = Get-ChildItem -Path $env:LOCALAPPDATA -Filter "Keyboard Manager.exe" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -like "*Programs*" } |
  Select-Object -First 1
if (-not $installedApp) {
  throw "Installed Keyboard Manager executable not found"
}

if (-not (Test-Path $marker)) {
  throw "User data was removed during update"
}

Write-Host "Windows installer update and data-retention smoke test ok"
