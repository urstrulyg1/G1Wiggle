@echo off
setlocal enabledelayedexpansion
:: ==============================================================================
:: G1Wiggle - Zero-Config Hardware & OS Desktop Packaging Script (Windows)
::
:: Automatically detects host hardware architecture:
::   - 64-bit Windows PC: Builds Windows x64 .exe (NSIS Installer)
::   - 32-bit Windows PC: Builds Windows x86/ia32 .exe (NSIS Installer)
::   - ARM64 Windows PC:  Builds Windows arm64 .exe (NSIS Installer)
::
:: Usage (no flags required):
::   build.bat                  Detects host hardware and builds native binary
::
:: Optional overrides:
::   build.bat --all            Builds all operating systems and architectures
::   build.bat --all-arch       Builds all architectures for the detected OS
::   build.bat --win            Forces Windows build
::   build.bat --mac            Forces macOS build
::   build.bat --linux          Forces Linux build
::   build.bat --arm64          Forces ARM64 architecture
::   build.bat --x64            Forces x64 architecture
::   build.bat --ia32           Forces x86 (32-bit) architecture
::   build.bat --clean          Wipes previous dist/ and release/ before build
::   build.bat --skip-tests     Skips the Vitest automated test suite
:: ==============================================================================

title G1Wiggle Build Engine

:: Switch working directory to the folder containing this script
cd /d "%~dp0"

:: --- Visual formatting (ANSI colors; supported on Windows 10+ terminals) ------
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "BOLD=!ESC![1m"
set "DIM=!ESC![2m"
set "GREEN=!ESC![0;32m"
set "CYAN=!ESC![0;36m"
set "YELLOW=!ESC![0;33m"
set "RED=!ESC![0;31m"
set "PURPLE=!ESC![0;35m"
set "NC=!ESC![0m"

:: Keep ARM64 Windows installers extractable: electron-builder 26.15.3's 7-Zip uses an ARM64
:: filter that the NSIS Nsis7z extractor cannot decode (installs without G1Wiggle.exe).
if not defined ELECTRON_BUILDER_7Z_FILTER set "ELECTRON_BUILDER_7Z_FILTER=BCJ"

:: --- 1. Hardware architecture auto-detection -----------------------------------
:: PROCESSOR_ARCHITEW6432 exposes the true machine arch when running 32-bit CMD
:: on 64-bit Windows; fall back to PROCESSOR_ARCHITECTURE otherwise.
set "HOST_PROCESSOR=%PROCESSOR_ARCHITECTURE%"
if defined PROCESSOR_ARCHITEW6432 set "HOST_PROCESSOR=%PROCESSOR_ARCHITEW6432%"

set "DETECTED_ARCH=x64"
set "ARCH_NAME=Intel / AMD 64-bit (x64)"
if /I "%HOST_PROCESSOR%"=="ARM64" (
  set "DETECTED_ARCH=arm64"
  set "ARCH_NAME=ARM64 (aarch64)"
)
if /I "%HOST_PROCESSOR%"=="x86" (
  set "DETECTED_ARCH=ia32"
  set "ARCH_NAME=Intel / AMD 32-bit (x86)"
)

:: Detect installed processor model name for display purposes
set "CPU_MODEL="
for /f "tokens=2*" %%a in ('reg query "HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0" /v ProcessorNameString 2^>nul ^| find "ProcessorNameString"') do set "CPU_MODEL=%%b"

:: Default target and arch from auto-detection
set "TARGET=win"
set "TARGET_ARCH=%DETECTED_ARCH%"
set "BUILD_ALL_ARCH=false"
set "EXPLICIT_CONFIG=false"
set "CLEAN_FIRST=false"
set "SKIP_TESTS=false"

:: --- 2. Argument parsing (optional overrides) -----------------------------------
:parse_args
if "%~1"=="" goto args_done

if /I "%~1"=="--mac"        (set "TARGET=mac"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="-m"           (set "TARGET=mac"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="mac"          (set "TARGET=mac"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--win"        (set "TARGET=win"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="-w"           (set "TARGET=win"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="win"          (set "TARGET=win"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--linux"      (set "TARGET=linux"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="-l"           (set "TARGET=linux"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="linux"        (set "TARGET=linux"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--arm64"      (set "TARGET_ARCH=arm64"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--x64"        (set "TARGET_ARCH=x64"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--ia32"       (set "TARGET_ARCH=ia32"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--x86"        (set "TARGET_ARCH=ia32"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--all-arch"   (set "BUILD_ALL_ARCH=true"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--all"        (set "TARGET=all"& set "BUILD_ALL_ARCH=true"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="-a"           (set "TARGET=all"& set "BUILD_ALL_ARCH=true"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="all"          (set "TARGET=all"& set "BUILD_ALL_ARCH=true"& set "EXPLICIT_CONFIG=true"& shift& goto parse_args)
if /I "%~1"=="--clean"      (set "CLEAN_FIRST=true"& shift& goto parse_args)
if /I "%~1"=="-c"           (set "CLEAN_FIRST=true"& shift& goto parse_args)
if /I "%~1"=="--skip-tests" (set "SKIP_TESTS=true"& shift& goto parse_args)
if /I "%~1"=="--help"       goto show_help
if /I "%~1"=="-h"           goto show_help
if /I "%~1"=="/?"           goto show_help

echo !YELLOW!Warning: Unknown option '%~1'. Using detected hardware !DIM![Windows !ARCH_NAME!]!NC!
shift
goto parse_args

:args_done

:: --- 3. Environment verification -------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo !RED!!BOLD!Error: Node.js was not found on PATH.!NC!
  echo !YELLOW!Install the LTS release from https://nodejs.org/ and run this script again.!NC!
  goto build_failed
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo !RED!!BOLD!Error: npm was not found on PATH.!NC!
  echo !YELLOW!Reinstall Node.js from https://nodejs.org/ to restore npm.!NC!
  goto build_failed
)

set "NODE_VERSION=unknown"
for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VERSION=%%v"

echo.
echo !GREEN!!BOLD!======================================================!NC!
echo !GREEN!!BOLD!   G1Wiggle - Hardware ^& OS Auto-Packaging Engine    !NC!
echo !GREEN!!BOLD!======================================================!NC!

if /I "%EXPLICIT_CONFIG%"=="false" (
  echo *!BOLD!Detected Operating System:!NC!  !GREEN!!BOLD!Windows!NC! !DIM![%OS%]!NC!
  echo *!BOLD!Detected Hardware Arch:!NC!    !PURPLE!!BOLD!!ARCH_NAME!!NC! !DIM![%HOST_PROCESSOR%]!NC!
  if not "!CPU_MODEL!"=="" echo *!BOLD!Detected Processor:!NC!        !CYAN!!CPU_MODEL!!NC!
  echo *!BOLD!Action:!NC!                    Building native package for this hardware
  echo   !DIM!^(Zero-flag mode: zero flags passed or required^)!NC!
) else (
  echo *!BOLD!Target Override:!NC!  !CYAN!!TARGET!!NC! !DIM!^(arch: !CYAN!!TARGET_ARCH!!DIM!, all-arch: !CYAN!!BUILD_ALL_ARCH!!DIM!^)!NC!
)

echo *!DIM!Node Environment:!NC!  !NODE_VERSION!
echo.

:: --- Bootstrap dependencies on first run ------------------------------------------
if not exist "node_modules\" (
  echo !YELLOW!node_modules not found - installing dependencies first...!NC!
  call npm install
  if errorlevel 1 goto build_failed
  echo.
)

:: --- 0. Clean previous release output to ensure only the target installer is created
echo !CYAN![1/6] Cleaning previous release directory...!NC!
if exist release rmdir /s /q release
if exist .icon-tmp rmdir /s /q .icon-tmp
if exist .icon-gen-tmp rmdir /s /q .icon-gen-tmp
if /I "%CLEAN_FIRST%"=="true" (
  if exist dist rmdir /s /q dist
  echo   Cleaned dist/ and release/
) else (
  echo   Cleaned release/
)

:: --- 1. Generate multi-resolution icons ^(.icns, .ico, .png^)
echo !CYAN![2/6] Generating branded desktop icons...!NC!
node scripts\generate-icons.mjs
if errorlevel 1 goto build_failed

:: --- 2. Run automated test suite
if /I "%SKIP_TESTS%"=="false" (
  echo !CYAN![3/6] Validating test suite with Vitest...!NC!
  call npm run test
  if errorlevel 1 goto build_failed
) else (
  echo !YELLOW![3/6] Skipping test suite !DIM![--skip-tests active]!NC!
)

:: --- 3. Build web production bundle ^(Vite singlefile^)
echo !CYAN![4/6] Compiling production web bundle !DIM!^(Vite^)!NC!...!NC!
call npm run build
if errorlevel 1 goto build_failed

:: --- 4. Package desktop releases via electron-builder
echo !CYAN![5/6] Packaging desktop binaries with electron-builder...!NC!

if /I "%TARGET%"=="win" (
  if /I "%BUILD_ALL_ARCH%"=="true" (
    echo   Packaging Windows EXEs for all architectures !DIM!^(64-bit x64 + 32-bit ia32/x86^)!NC!
    call npx electron-builder --win --x64 --ia32 -p never --config electron-builder.json
  ) else (
    echo   Packaging Windows EXE specifically for detected hardware !DIM!^(!TARGET_ARCH!^)!NC!
    call npx electron-builder --win --!TARGET_ARCH! -p never --config electron-builder.json
  )
  if errorlevel 1 goto build_failed
)

if /I "%TARGET%"=="mac" (
  if /I "%BUILD_ALL_ARCH%"=="true" (
    echo   Packaging macOS DMGs for all architectures !DIM!^(Apple Silicon arm64 + Intel x64^)!NC!
    call npx electron-builder --mac --arm64 --x64 -p never --config electron-builder.json
  ) else (
    echo   Packaging macOS DMG specifically for selected hardware !DIM!^(!TARGET_ARCH!^)!NC!
    call npx electron-builder --mac --!TARGET_ARCH! -p never --config electron-builder.json
  )
  if errorlevel 1 goto build_failed
)

if /I "%TARGET%"=="linux" (
  if /I "%BUILD_ALL_ARCH%"=="true" (
    echo   Packaging Linux packages for all architectures !DIM!^(x64 + arm64^)!NC!
    call npx electron-builder --linux --x64 --arm64 -p never --config electron-builder.json
  ) else (
    if /I "!TARGET_ARCH!"=="ia32" (
      echo   !RED!Linux ia32 is not supported: Electron stopped publishing 32-bit x86 Linux builds in v19.!NC!
      goto build_failed
    )
    echo   Packaging Linux package specifically for selected hardware !DIM!^(!TARGET_ARCH!^)!NC!
    call npx electron-builder --linux --!TARGET_ARCH! -p never --config electron-builder.json
  )
  if errorlevel 1 goto build_failed
)

if /I "%TARGET%"=="all" (
  echo   Cross-compiling macOS DMGs !DIM!^(arm64 + x64^)!NC!
  call npx electron-builder --mac --arm64 --x64 -p never --config electron-builder.json
  if errorlevel 1 goto build_failed
  echo   Cross-compiling Windows EXEs !DIM!^(x64 + ia32/x86^)!NC!
  call npx electron-builder --win --x64 --ia32 -p never --config electron-builder.json
  if errorlevel 1 goto build_failed
  echo   Cross-compiling Linux packages !DIM!^(x64 + arm64^)!NC!
  call npx electron-builder --linux --x64 --arm64 -p never --config electron-builder.json
  if errorlevel 1 goto build_failed
)

:: --- 5. Purge all intermediate updater blockmaps, metadata manifests, and staging folders
echo !CYAN![6/6] Purging intermediate metadata and staging folders...!NC!
if exist release (
  del /q /f release\*.blockmap >nul 2>nul
  del /q /f release\*.yml >nul 2>nul
  del /q /f release\*.yaml >nul 2>nul
  del /q /f release\*.zip >nul 2>nul
  for /d %%d in (release\mac-* release\win-* release\linux-* release\*-unpacked) do (
    if exist "%%d" rmdir /s /q "%%d" >nul 2>nul
  )
)

echo.
echo !GREEN!!BOLD!======================================================!NC!
echo !GREEN!!BOLD!       Packaging Completed Successfully!             !NC!
echo !GREEN!!BOLD!======================================================!NC!
echo !BOLD!Generated Native Hardware Installer in release/:!NC!
echo.

if exist release (
  for %%f in (release\*.exe release\*.dmg release\*.AppImage release\*.deb) do (
    if exist "%%f" echo   !GREEN!%%~nxf!NC! !DIM![%%~zf bytes]!NC!
  )
)

echo.
echo !CYAN!Your native desktop installer is ready in:!NC! !BOLD!%~dp0release\!NC!
echo.

endlocal
exit /b 0

:build_failed
echo.
echo !RED!!BOLD!======================================================!NC!
echo !RED!!BOLD!        Build Failed - see error output above         !NC!
echo !RED!!BOLD!======================================================!NC!
echo.
endlocal
exit /b 1

:show_help
echo.
echo !BOLD!G1Wiggle Zero-Config Hardware ^& OS Packaging Utility ^(Windows^)!NC!
echo.
echo Usage: !CYAN!build.bat!NC! !DIM!(no flags needed - automatically detects your hardware architecture)!NC!
echo.
echo Optional overrides:
echo   !CYAN!--all, -a!NC!         Cross-compile all operating systems and architectures
echo   !CYAN!--all-arch!NC!        Build all architectures for the current OS ^(e.g. x64 + ia32^)
echo   !CYAN!--mac, -m!NC!         Build for macOS
echo   !CYAN!--win, -w!NC!         Build for Windows
echo   !CYAN!--linux, -l!NC!       Build for Linux
echo   !CYAN!--arm64!NC!           Force ARM64 build
echo   !CYAN!--x64!NC!             Force Intel / AMD 64-bit build
echo   !CYAN!--ia32, --x86!NC!     Force 32-bit x86 build
echo   !CYAN!--clean, -c!NC!       Clean dist/ and release/ directories before packaging
echo   !CYAN!--skip-tests!NC!      Skip running the Vitest automated test suite
echo   !CYAN!--help, -h!NC!        Show this help documentation
echo.
exit /b 0
