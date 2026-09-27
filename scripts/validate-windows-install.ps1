param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][ValidateSet("x64","arm64","ia32")][string]$ExpectedArchitecture,
  [Parameter(Mandatory = $true)][string]$ExpectedVersion,
  [Parameter(Mandatory = $true)][string]$ProductName = "G1Wiggle"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$diagnosticLog = Join-Path $env:RUNNER_TEMP ("g1wiggle-windows-install-$ExpectedArchitecture.log")
Start-Transcript -Path $diagnosticLog -Force | Out-Null
trap {
  $originalError = $_
  try { Stop-Transcript | Out-Null } catch {}
  Write-Error $originalError
  exit 1
}

function Fail([string]$Message) { throw $Message }

function Get-PeArchitecture([string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 0x40 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { Fail "Not a valid Windows PE executable: $Path" }
  $peOffset = [BitConverter]::ToInt32($bytes, 0x3C)
  if ($peOffset -lt 0 -or $peOffset + 6 -ge $bytes.Length) { Fail "Invalid PE header offset in: $Path" }
  if ([BitConverter]::ToUInt32($bytes, $peOffset) -ne 0x00004550) { Fail "Invalid PE signature in: $Path" }
  $machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
  switch ($machine) {
    0x8664 { return "x64" }
    0xAA64 { return "arm64" }
    0x014C { return "ia32" }
    default { return ("unknown(0x{0:X4})" -f $machine) }
  }
}

function Get-PropertyValue($Object, [string]$Name) {
  $property = $Object.PSObject.Properties[$Name]
  if ($null -ne $property) { return $property.Value }
  return $null
}

function Get-UninstallEntries {
  $paths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )
  foreach ($p in $paths) {
    Get-ItemProperty -Path $p -ErrorAction SilentlyContinue |
      Where-Object { (Get-PropertyValue $_ "DisplayName") -eq $ProductName }
  }
}

if (!(Test-Path -LiteralPath $InstallerPath -PathType Leaf)) { Fail "Installer does not exist: $InstallerPath" }
$installer = Get-Item -LiteralPath $InstallerPath
if ($installer.Length -le 0) { Fail "Installer is empty: $InstallerPath" }
Write-Host "Installer SHA256: $((Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash)"
Write-Host "Installer extension: $($installer.Extension)"
if ($installer.Extension -ne ".exe") { Fail "Expected an NSIS .exe installer, got: $($installer.Extension)" }
try {
  $null = Get-PeArchitecture $installer.FullName
} catch {
  Fail "Generated installer is not a valid PE executable: $($_.Exception.Message)"
}

$expected = $ExpectedVersion -replace '^v', ''
$requestedDir = Join-Path $env:RUNNER_TEMP ("G1Wiggle-install-" + $ExpectedArchitecture)
Remove-Item -LiteralPath $requestedDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $requestedDir -Force | Out-Null

Write-Host "=== G1Wiggle Windows installation validation ==="
Write-Host "Installer path: $($installer.FullName)"
Write-Host "Installer size: $($installer.Length) bytes"
Write-Host "Expected architecture: $ExpectedArchitecture"
Write-Host "Expected version: $expected"
Write-Host "Requested install directory: $requestedDir"

$proc = Start-Process -FilePath $installer.FullName -ArgumentList @("/S", "/D=$requestedDir") -Wait -PassThru
Write-Host "Installer exit code: $($proc.ExitCode)"
if ($proc.ExitCode -ne 0) { Fail "NSIS installer failed with exit code $($proc.ExitCode)." }
Start-Sleep -Seconds 2

$entries = @(Get-UninstallEntries)
if ($entries.Count -eq 0) { Fail "No uninstall registry entry was found for '$ProductName'." }

Write-Host "Matching uninstall registry entries:"
$entries | Select-Object PSPath,DisplayName,DisplayVersion,InstallLocation,DisplayIcon,Publisher,UninstallString | Format-List | Out-String | Write-Host

$entry = $entries |
  Where-Object {
    $installLocation = [string](Get-PropertyValue $_ "InstallLocation")
    $installLocation -and (Test-Path -LiteralPath $installLocation -PathType Container)
  } |
  Sort-Object @{ Expression = {
    $installLocation = [string](Get-PropertyValue $_ "InstallLocation")
    if ($installLocation -and ([System.IO.Path]::GetFullPath($installLocation).TrimEnd('\') -eq $requestedDir.TrimEnd('\'))) { 0 } else { 1 }
  }} |
  Select-Object -First 1
if ($null -eq $entry) { $entry = $entries | Select-Object -First 1 }

$installDir = [string](Get-PropertyValue $entry "InstallLocation")
$displayIcon = [string](Get-PropertyValue $entry "DisplayIcon")
if ([string]::IsNullOrWhiteSpace($installDir) -and $displayIcon) {
  $iconPath = $displayIcon -replace ',\s*-?\d+$', ''
  $iconPath = $iconPath.Trim('"')
  if (Test-Path -LiteralPath $iconPath -PathType Leaf) {
    $installDir = Split-Path -Parent $iconPath
    Write-Host "InstallLocation missing; derived installation directory from DisplayIcon: $installDir"
  }
}
if ([string]::IsNullOrWhiteSpace($installDir)) {
  Write-Host "All matching uninstall registrations:"
  $entries | Format-List | Out-String | Write-Host
  Fail "Installer metadata contains no usable InstallLocation or DisplayIcon."
}
$installDir = [System.IO.Path]::GetFullPath($installDir)

Write-Host "Detected installation directory: $installDir"
Write-Host "Registry key: $($entry.PSPath)"
Write-Host "DisplayVersion: $(Get-PropertyValue $entry "DisplayVersion")"
Write-Host "DisplayIcon: $(Get-PropertyValue $entry "DisplayIcon")"
Write-Host "Publisher: $(Get-PropertyValue $entry "Publisher")"
Write-Host "UninstallString: $(Get-PropertyValue $entry "UninstallString")"

if (!(Test-Path -LiteralPath $installDir -PathType Container)) { Fail "Detected installation directory does not exist: $installDir" }

$candidates = @(Get-ChildItem -LiteralPath $installDir -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $vi = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($_.FullName)
    [pscustomobject]@{
      Path = $_.FullName
      Length = $_.Length
      ProductName = $vi.ProductName
      FileDescription = $vi.FileDescription
      FileVersion = $vi.FileVersion
      ProductVersion = $vi.ProductVersion
    }
  } |
  Where-Object {
    $_.ProductName -eq $ProductName -and
    (($_.FileVersion -match [regex]::Escape($expected)) -or ($_.ProductVersion -match [regex]::Escape($expected)))
  })

if ($candidates.Count -ne 1) {
  Write-Host "Executable candidates matching product/version:"
  $candidates | Format-Table -AutoSize | Out-String | Write-Host
  Write-Host "All installed files:"
  Get-ChildItem -LiteralPath $installDir -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize | Out-String | Write-Host
  Fail "Could not uniquely identify the installed G1Wiggle executable from installer metadata and executable version metadata."
}

$exePath = $candidates[0].Path
Write-Host "Discovered executable: $exePath"
Write-Host "Executable size: $($candidates[0].Length) bytes"
Write-Host "ProductName: $($candidates[0].ProductName)"
Write-Host "FileVersion: $($candidates[0].FileVersion)"
Write-Host "ProductVersion: $($candidates[0].ProductVersion)"

$peArchitecture = Get-PeArchitecture $exePath
Write-Host "Detected PE architecture: $peArchitecture"
if ($peArchitecture -ne $ExpectedArchitecture) { Fail "Architecture mismatch: expected $ExpectedArchitecture, detected $peArchitecture." }
$registryVersion = [string](Get-PropertyValue $entry "DisplayVersion")
if ($registryVersion -and $registryVersion -ne $expected) { Fail "Registry version mismatch: expected $expected, registry reports $registryVersion." }

$stdout = Join-Path $env:RUNNER_TEMP ("g1wiggle-startup-$ExpectedArchitecture.stdout.log")
$stderr = Join-Path $env:RUNNER_TEMP ("g1wiggle-startup-$ExpectedArchitecture.stderr.log")
Remove-Item -LiteralPath $stdout,$stderr -Force -ErrorAction SilentlyContinue

Write-Host "Launching installed application for startup smoke test..."
$versionProc = Start-Process -FilePath $exePath -ArgumentList @("--version") -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Host "Application --version exit code: $($versionProc.ExitCode)"
if (Test-Path -LiteralPath $stdout) { Write-Host "Application stdout:"; Get-Content -LiteralPath $stdout | Write-Host }
if (Test-Path -LiteralPath $stderr) { Write-Host "Application stderr:"; Get-Content -LiteralPath $stderr | Write-Host }
if ($versionProc.ExitCode -ne 0) { Fail "Installed application startup smoke test failed with exit code $($versionProc.ExitCode)." }

$running = @(Get-Process -Name "G1Wiggle" -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $exePath } catch { $false } })
if ($running.Count -gt 0) {
  Write-Host "G1Wiggle remained running after smoke test; terminating only the discovered executable."
  $running | Stop-Process -Force -ErrorAction Stop
  Start-Sleep -Milliseconds 500
}
$stillRunning = @(Get-Process -Name "G1Wiggle" -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $exePath } catch { $false } })
if ($stillRunning.Count -gt 0) { Fail "G1Wiggle did not terminate cleanly after the startup smoke test." }

Write-Host "Windows installation validation PASSED."
Stop-Transcript | Out-Null
