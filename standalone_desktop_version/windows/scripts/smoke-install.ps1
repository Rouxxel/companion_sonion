<#
.SYNOPSIS
  Installer round trip for Sonion Companion: silent install -> first launch -> single instance ->
  Start with Windows -> Task Manager "disabled" is respected -> update over itself -> silent uninstall.

.DESCRIPTION
  Installs the app for the current user (no admin), so it touches your real Windows profile:
  %LOCALAPPDATA%\Programs\Sonion Companion, Start menu/desktop shortcuts, the Installed apps entry,
  and HKCU\...\Run\SonionCompanion. Everything is removed again at the end (unless -KeepInstalled).
  Your %APPDATA%\Sonion Companion\companions.json is backed up first and restored at the end.
  Run it in Windows Sandbox or a VM if you prefer not to touch your profile.

  The script refuses to run while Sonion Companion is already installed (use -Force to replace that
  installation; it will be uninstalled at the end).

.PARAMETER Installer
  Path to SonionCompanion-Setup-<version>.exe. Defaults to the newest one in release/.

.PARAMETER KeepInstalled
  Leave the app installed after the checks (for manual checks such as pinning or the uninstall prompt).

.EXAMPLE
  npm run test:install
  powershell -ExecutionPolicy Bypass -File scripts/smoke-install.ps1 -KeepInstalled
#>
[CmdletBinding()]
param(
  [string]$Installer,
  [switch]$KeepInstalled,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Installer) {
  $Installer = Get-ChildItem (Join-Path $root "release") -Filter "SonionCompanion-Setup-*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Installer -or -not (Test-Path $Installer)) { throw "Installer not found. Build it with 'npm run package' or pass -Installer <path>." }
$version = [regex]::Match((Split-Path -Leaf $Installer), "Setup-(.+)\.exe$").Groups[1].Value

$installDir = Join-Path $env:LOCALAPPDATA "Programs\Sonion Companion"
$exe = Join-Path $installDir "Sonion Companion.exe"
$uninstaller = Join-Path $installDir "Uninstall Sonion Companion.exe"
$startMenuLink = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Sonion Companion.lnk"
$desktopLink = Join-Path ([Environment]::GetFolderPath("Desktop")) "Sonion Companion.lnk"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$approvedKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
$valueName = "SonionCompanion"
$dataDir = Join-Path $env:APPDATA "Sonion Companion"
$configFile = Join-Path $dataDir "companions.json"

$script:failures = 0
$script:installedByScript = $false
function Check([string]$name, [bool]$ok) {
  if ($ok) { Write-Host "PASS $name" -ForegroundColor Green } else { Write-Host "FAIL $name" -ForegroundColor Red; $script:failures++ }
}
function RunValue { (Get-ItemProperty $runKey -Name $valueName -ErrorAction SilentlyContinue).$valueName }
function ApprovedValue { (Get-ItemProperty $approvedKey -Name $valueName -ErrorAction SilentlyContinue).$valueName }
function AppsEntry { Get-ChildItem HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall | Get-ItemProperty | Where-Object DisplayName -eq "Sonion Companion" }
function Settings { (Get-Content $configFile -Raw | ConvertFrom-Json).settings }
function MainProcessCount { @(Get-CimInstance Win32_Process -Filter "Name='Sonion Companion.exe'" | Where-Object { $_.CommandLine -notmatch "--type=" }).Count }
function StopApp { Get-Process "Sonion Companion" -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 2 }
function StartApp { $p = Start-Process $exe -PassThru; Start-Sleep -Seconds 8; return $p }
function RunSilent([string]$path) { $p = Start-Process $path -ArgumentList "/S" -PassThru -Wait; Start-Sleep -Seconds 2; return $p.ExitCode }

if ((Test-Path $exe) -and -not $Force) { throw "Sonion Companion is already installed in $installDir. Use -Force to replace it (it will be uninstalled at the end)." }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# Back up the user's data
$backup = $null
if (Test-Path $configFile) {
  $backup = Join-Path $env:TEMP "sonion-smoke-backup-$(Get-Date -Format yyyyMMddHHmmss).json"
  Copy-Item $configFile $backup
  Write-Host "Backed up companions.json to $backup"
}

try {
  Write-Host "`n== Install ($Installer)"
  StopApp
  $script:installedByScript = $true
  Check "silent install exits with 0" ((RunSilent $Installer) -eq 0)
  Check "installed per-user to $installDir" (Test-Path $exe)
  Check "Start menu shortcut exists" (Test-Path $startMenuLink)
  Check "desktop shortcut exists" (Test-Path $desktopLink)
  if (Test-Path $startMenuLink) {
    $target = (New-Object -ComObject WScript.Shell).CreateShortcut($startMenuLink).TargetPath
    Check "Start menu shortcut points at the installed exe" ($target -eq $exe)
  }
  $entry = AppsEntry
  Check "Installed apps entry: '$($entry.DisplayName)' $($entry.DisplayVersion) by '$($entry.Publisher)'" ($entry -and $entry.DisplayVersion -eq $version -and $entry.Publisher -and $entry.DisplayIcon)

  Write-Host "`n== First launch"
  if (Test-Path $configFile) {
    # Simulate a fresh installation for the first-run checks (the backup is restored at the end)
    $cfg = Get-Content $configFile -Raw | ConvertFrom-Json
    if ($cfg.settings) { $cfg.settings.PSObject.Properties.Remove("autostartInitialized"); $cfg.settings.PSObject.Properties.Remove("startWithWindows") }
    [IO.File]::WriteAllText($configFile, ($cfg | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
  }
  $app = StartApp
  Check "app is running" (-not $app.HasExited)
  Check "first launch turns on Start with Windows ($(RunValue))" ((RunValue) -like "*Sonion Companion.exe*--autostart*")
  $s = Settings
  Check "settings record it (startWithWindows=$($s.startWithWindows), autostartInitialized=$($s.autostartInitialized))" ($s.startWithWindows -eq $true -and $s.autostartInitialized -eq $true)
  $second = Start-Process $exe -PassThru; $null = $second.WaitForExit(15000)
  Check "a second launch exits (exit code $($second.ExitCode))" ($second.HasExited -and $second.ExitCode -eq 0)
  Check "only one main process runs" ((MainProcessCount) -eq 1)
  StopApp

  Write-Host "`n== Turned off in Task Manager"
  if (-not (Test-Path $approvedKey)) { New-Item $approvedKey -Force | Out-Null }
  New-ItemProperty $approvedKey -Name $valueName -PropertyType Binary -Value ([byte[]](3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)) -Force | Out-Null
  $null = StartApp
  Check "app reports Start with Windows as off" ((Settings).startWithWindows -eq $false)
  $approved = ApprovedValue
  Check "app does not turn it back on" ($approved -and $approved[0] -eq 3)
  StopApp

  Write-Host "`n== Update (install over the existing installation)"
  Check "update install exits with 0" ((RunSilent $Installer) -eq 0)
  Check "Start with Windows entry kept" ([bool](RunValue))
  Check "Task Manager choice kept" ([bool](ApprovedValue))
  Check "user data kept" (Test-Path $configFile)

  if ($KeepInstalled) {
    Write-Host "`n-KeepInstalled: leaving the app installed. Uninstall it from Settings -> Apps when done." -ForegroundColor Yellow
  } else {
    Write-Host "`n== Silent uninstall"
    StopApp
    Check "silent uninstall exits with 0" ((RunSilent $uninstaller) -eq 0)
    Start-Sleep -Seconds 2
    Check "program files removed" (-not (Test-Path $exe))
    Check "shortcuts removed" (-not (Test-Path $startMenuLink) -and -not (Test-Path $desktopLink))
    Check "Installed apps entry removed" (-not (AppsEntry))
    Check "Start with Windows entry removed" (-not (RunValue))
    Check "Task Manager entry removed" (-not (ApprovedValue))
    Check "user data kept (silent uninstall)" (Test-Path $configFile)
  }
}
catch {
  Write-Host "FAIL script stopped: $($_.Exception.Message)" -ForegroundColor Red
  $script:failures++
}
finally {
  if (-not $KeepInstalled) {
    StopApp
    # Never leave a half-tested installation behind if the script stopped early.
    if ($script:installedByScript -and (Test-Path $uninstaller)) {
      Write-Host "Cleaning up: uninstalling the test installation"
      $null = RunSilent $uninstaller
      Remove-ItemProperty $runKey -Name $valueName -ErrorAction SilentlyContinue
      Remove-ItemProperty $approvedKey -Name $valueName -ErrorAction SilentlyContinue
    }
  }
  if ($backup) { Copy-Item $backup $configFile -Force; Remove-Item $backup; Write-Host "`nRestored your companions.json" }
}

Write-Host ""
if ($script:failures -eq 0) { Write-Host "All checks passed." -ForegroundColor Green } else { Write-Host "$($script:failures) check(s) failed." -ForegroundColor Red }
exit $script:failures
