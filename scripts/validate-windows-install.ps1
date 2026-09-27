param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][ValidateSet("x64","arm64","ia32")][string]$ExpectedArchitecture,
  [Parameter(Mandatory=$true)][string]$ExpectedVersion,
  [Parameter(Mandatory=$true)][string]$ProductName = "G1Wiggle"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail([string]$Message) { throw $Message }

function Get-PeArchitecture([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { Fail "Not a valid PE executable: $Path" }
  $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
  if ($peOffset -lt 0 -or $peOffset + 6 -ge $bytes.Length) { Fail "Invalid PE header offset in $Path" }
  if ([BitConverter]::ToUInt32($bytes, $peOffset) -ne 0x00004550) { Fail "Invalid PE signature in $Path" }
  $machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
  switch ($machine) {
    0x8664 { "x64" }
    0xAA64 { "arm64" }
    0x014C { "ia32" }
    default { "unknown(0x{0:X4})" -f $machine }
  }
}

function Get-UninstallEntries {
  @(
    "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
  ) | ForEach-Object {
    Get-ItemProperty -Path $_ -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -eq $ProductName }
  }
}

if (!(Test-Path -LiteralPath $InstallerPath -PathType Leaf)) { Fail "Installer does not exist: $InstallerPath" }
$installer = Get-Item -LiteralPath $InstallerPath
if ($installer.Length -le 0) { Fail "Installer is empty: $InstallerPath" }

Write-Host "=== G1Wiggle Windows installer validation ==="
Write-Host "Installer: $($installer.FullName)"
Write-Host "Installer size: $($installer.Length) bytes"
Write-Host "Expected architecture: $ExpectedArchitecture"
Write-Host "Expected version: $ExpectedVersion"

$requestedDir = Join-Path $env:RUNNER_TEMP ("G1Wiggle-install-" + $ExpectedArchitecture)
Remove-Item -LiteralPath $requestedDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $requestedDir -Force | Out-Null

$proc = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "/D=$requestedDir") -Wait -PassThru
Write-Host "Installer exit code: $($proc.ExitCode)"
if ($proc.ExitCode -ne 0) { Fail "NSIS installer failed with exit code $($proc.ExitCode)" }
Start-Sleep -Seconds 2

$entries = @(Get-UninstallEntries)
if ($entries.Count -eq 0) { Fail "No Windows uninstall registration found for '$ProductName'." }

$entry = $entries |
  Where-Object { $_.InstallLocation -and (Test-Path -LiteralPath $_.InstallLocation) } |
  Sort-Object @{ Expression = {
    if ($_.InstallLocation -and [System.IO.Path]::GetFullPath($_.InstallLocation).TrimEnd('\') -eq $requestedDir.TrimEnd('\')) { 0 } else { 1 }
  }} |
  Select-Object -First 1
if ($null -eq $entry) { $entry = $entries | Select-Object -First 1 }

$installDir = [string]$entry.InstallLocation
if ([string]::IsNullOrWhiteSpace($installDir) -and $entry.DisplayIcon) {
  $iconPath = ([string]$entry.DisplayIcon) -replace ',\s*-?\d+

Write-Host "Detected installation directory: $installDir"
Write-Host "Registry key: $($entry.PSPath)"
Write-Host "DisplayName: $($entry.DisplayName)"
Write-Host "DisplayVersion: $($entry.DisplayVersion)"
Write-Host "DisplayIcon: $($entry.DisplayIcon)"
Write-Host "Publisher: $($entry.Publisher)"
Write-Host "UninstallString: $($entry.UninstallString)"

if (!(Test-Path -LiteralPath $installDir -PathType Container)) { Fail "Detected installation directory does not exist: $installDir" }

$expected = $ExpectedVersion -replace '^v',''
$candidates = @(Get-ChildItem -LiteralPath $installDir -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
  $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($_.FullName)
  [pscustomobject]@{
    Path = $_.FullName
    Length = $_.Length
    ProductName = $vi.ProductName
    FileDescription = $vi.FileDescription
    FileVersion = $vi.FileVersion
    ProductVersion = $vi.ProductVersion
  }
} | Where-Object {
  $_.ProductName -eq $ProductName -and
  (($_.FileVersion -match [regex]::Escape($expected)) -or ($_.ProductVersion -match [regex]::Escape($expected)))
})

if ($candidates.Count -ne 1) {
  Write-Host "Executable candidates discovered under the installer-reported directory:"
  $candidates | Format-Table -AutoSize | Out-String | Write-Host
  Write-Host "All installed files:"
  Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
  Fail "Could not uniquely identify the installed application executable from product metadata/version."
}

$exePath = $candidates[0].Path
Write-Host "Detected application executable: $exePath"
Write-Host "Executable ProductName: $($candidates[0].ProductName)"
Write-Host "Executable FileVersion: $($candidates[0].FileVersion)"
Write-Host "Executable ProductVersion: $($candidates[0].ProductVersion)"

$peArch = Get-PeArchitecture $exePath
Write-Host "Detected PE architecture: $peArch"
if ($peArch -ne $ExpectedArchitecture) { Fail "Architecture mismatch: expected $ExpectedArchitecture, installed executable is $peArch." }

if ($entry.DisplayVersion -and $entry.DisplayVersion -ne $expected) {
  Fail "Registry version mismatch: expected $expected, registry reports $($entry.DisplayVersion)."
}

$stdout = Join-Path $env:RUNNER_TEMP "g1wiggle-startup-$ExpectedArchitecture.stdout.log"
$stderr = Join-Path $env:RUNNER_TEMP "g1wiggle-startup-$ExpectedArchitecture.stderr.log"
Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue
$versionProc = Start-Process -FilePath $exePath -ArgumentList "--version" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Host "Application --version exit code: $($versionProc.ExitCode)"
if (Test-Path $stdout) { Write-Host "Application stdout:"; Get-Content $stdout | Write-Host }
if (Test-Path $stderr) { Write-Host "Application stderr:"; Get-Content $stderr | Write-Host }
if ($versionProc.ExitCode -ne 0) { Fail "Application startup smoke test failed with exit code $($versionProc.ExitCode)." }

$running = @(Get-Process -Name "G1Wiggle" -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -eq $exePath } catch { $false }
})
if ($running.Count -gt 0) {
  Write-Host "Application process remained after smoke test; terminating only the discovered G1Wiggle process(es)."
  $running | Stop-Process -Force -ErrorAction Stop
  Start-Sleep -Milliseconds 500
}
$stillRunning = @(Get-Process -Name "G1Wiggle" -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -eq $exePath } catch { $false }
})
if ($stillRunning.Count -gt 0) { Fail "G1Wiggle process did not terminate cleanly after smoke test." }

Write-Host "Windows installation validation PASSED."
,''
  $iconPath = $iconPath.Trim('"')
  if (Test-Path -LiteralPath $iconPath -PathType Leaf) {
    $installDir = Split-Path -Parent $iconPath
    Write-Host "InstallLocation missing; derived installation directory from DisplayIcon: $installDir"
  }
}
if ([string]::IsNullOrWhiteSpace($installDir)) {
  Write-Host "All matching uninstall registrations:"
  $entries | Select-Object PSPath,DisplayName,DisplayVersion,InstallLocation,DisplayIcon,UninstallString | Format-List | Out-String | Write-Host
  Fail "Installer registry entry has neither a usable InstallLocation nor a usable DisplayIcon."
}
$installDir = [System.IO.Path]::GetFullPath($installDir)

Write-Host "Detected installation directory: $installDir"
Write-Host "Registry key: $($entry.PSPath)"
Write-Host "DisplayName: $($entry.DisplayName)"
Write-Host "DisplayVersion: $($entry.DisplayVersion)"
Write-Host "DisplayIcon: $($entry.DisplayIcon)"
Write-Host "Publisher: $($entry.Publisher)"
Write-Host "UninstallString: $($entry.UninstallString)"

if (!(Test-Path -LiteralPath $installDir -PathType Container)) { Fail "Detected installation directory does not exist: $installDir" }

$expected = $ExpectedVersion -replace '^v',''
$candidates = @(Get-ChildItem -LiteralPath $installDir -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
  $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($_.FullName)
  [pscustomobject]@{
    Path = $_.FullName
    Length = $_.Length
    ProductName = $vi.ProductName
    FileDescription = $vi.FileDescription
    FileVersion = $vi.FileVersion
    ProductVersion = $vi.ProductVersion
  }
} | Where-Object {
  $_.ProductName -eq $ProductName -and
  (($_.FileVersion -match [regex]::Escape($expected)) -or ($_.ProductVersion -match [regex]::Escape($expected)))
})

if ($candidates.Count -ne 1) {
  Write-Host "Executable candidates discovered under the installer-reported directory:"
  $candidates | Format-Table -AutoSize | Out-String | Write-Host
  Write-Host "All installed files:"
  Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
  Fail "Could not uniquely identify the installed application executable from product metadata/version."
}

$exePath = $candidates[0].Path
Write-Host "Detected application executable: $exePath"
Write-Host "Executable ProductName: $($candidates[0].ProductName)"
Write-Host "Executable FileVersion: $($candidates[0].FileVersion)"
Write-Host "Executable ProductVersion: $($candidates[0].ProductVersion)"

$peArch = Get-PeArchitecture $exePath
Write-Host "Detected PE architecture: $peArch"
if ($peArch -ne $ExpectedArchitecture) { Fail "Architecture mismatch: expected $ExpectedArchitecture, installed executable is $peArch." }

if ($entry.DisplayVersion -and $entry.DisplayVersion -ne $expected) {
  Fail "Registry version mismatch: expected $expected, registry reports $($entry.DisplayVersion)."
}

$stdout = Join-Path $env:RUNNER_TEMP "g1wiggle-startup-$ExpectedArchitecture.stdout.log"
$stderr = Join-Path $env:RUNNER_TEMP "g1wiggle-startup-$ExpectedArchitecture.stderr.log"
Remove-Item $stdout,$stderr -Force -ErrorAction SilentlyContinue
$versionProc = Start-Process -FilePath $exePath -ArgumentList "--version" -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Host "Application --version exit code: $($versionProc.ExitCode)"
if (Test-Path $stdout) { Write-Host "Application stdout:"; Get-Content $stdout | Write-Host }
if (Test-Path $stderr) { Write-Host "Application stderr:"; Get-Content $stderr | Write-Host }
if ($versionProc.ExitCode -ne 0) { Fail "Application startup smoke test failed with exit code $($versionProc.ExitCode)." }

Write-Host "Windows installation validation PASSED."
