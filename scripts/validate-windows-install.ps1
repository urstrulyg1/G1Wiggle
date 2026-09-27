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
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
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
if ([string]::IsNullOrWhiteSpace($installDir)) { Fail "Installer registry entry has no InstallLocation: $($entry.PSPath)" }
$installDir = [System.IO.Path]::GetFullPath($installDir)

Write-Host "Detected installation directory: $installDir"
Write-Host "Registry key: $($entry.PSPath)"
Write-Host "DisplayName: $($entry.DisplayName)"
Write-Host "DisplayVersion: $($entry.DisplayVersion)"
Write-Host "UninstallString: $($entry.UninstallString)"

if (!(Test-Path -LiteralPath $installDir -PathType Container)) { Fail "Detected installation directory does not exist: $installDir" }

$candidates = @(Get-ChildItem -LiteralPath $installDir -Recurse -File -Filter "$ProductName.exe" -ErrorAction SilentlyContinue)
if ($candidates.Count -ne 1) {
  Write-Host "Installed executable candidates:"
  Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
  Fail "Expected exactly one $ProductName.exe under the installer-reported installation directory; found $($candidates.Count)."
}

$exePath = $candidates[0].FullName
Write-Host "Detected executable: $exePath"

$peArch = Get-PeArchitecture $exePath
Write-Host "Detected PE architecture: $peArch"
if ($peArch -ne $ExpectedArchitecture) { Fail "Architecture mismatch: expected $ExpectedArchitecture, installed executable is $peArch." }

$versionInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exePath)
$fileVersion = $versionInfo.FileVersion
$productVersion = $versionInfo.ProductVersion
$expected = $ExpectedVersion -replace '^v',''
Write-Host "Executable FileVersion: $fileVersion"
Write-Host "Executable ProductVersion: $productVersion"
if (($fileVersion -notmatch [regex]::Escape($expected)) -and ($productVersion -notmatch [regex]::Escape($expected))) {
  Fail "Version mismatch: expected $expected, executable reports FileVersion=$fileVersion ProductVersion=$productVersion."
}
if ($entry.DisplayVersion -and $entry.DisplayVersion -ne $expected) { Fail "Registry version mismatch: expected $expected, registry reports $($entry.DisplayVersion)." }

$versionProc = Start-Process -FilePath $exePath -ArgumentList "--version" -Wait -PassThru -NoNewWindow
Write-Host "Application --version exit code: $($versionProc.ExitCode)"
if ($versionProc.ExitCode -ne 0) { Fail "Application startup smoke test failed with exit code $($versionProc.ExitCode)." }

Write-Host "Installed files:"
Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue |
  Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "Windows installation validation PASSED."
