#!/usr/bin/env bash
# ==============================================================================
# G1Wiggle — Zero-Config Desktop Packaging Script
# 
# Automatically detects host operating system:
#   - macOS: Builds .dmg & .zip for Apple Silicon (arm64) & Intel (x64)
#   - Windows: Builds .exe installers & portables for 64-bit (x64) & 32-bit (x86/ia32)
#   - Linux: Builds AppImage & .deb for 64-bit (x64) & ARM64
#
# Usage (no flags required):
#   ./build.sh                  # Automatically detects OS and builds native packages
#
# Optional manual overrides:
#   ./build.sh --all            # Builds all desktop platforms
#   ./build.sh --mac            # Forces macOS build (.dmg)
#   ./build.sh --win            # Forces Windows build (.exe)
#   ./build.sh --linux          # Forces Linux build (AppImage / deb)
#   ./build.sh --clean          # Wipes previous dist/ and release/ before building
# ==============================================================================

set -euo pipefail

# Visual formatting
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Auto-detect host operating system
UNAME_S="$(uname -s 2>/dev/null || echo 'Unknown')"
DETECTED_OS="unknown"
DETECTED_DESC="Unknown"

case "$UNAME_S" in
  Darwin*)
    DETECTED_OS="mac"
    DETECTED_DESC="macOS (.dmg for Apple Silicon arm64 & Intel x64)"
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT*)
    DETECTED_OS="win"
    DETECTED_DESC="Windows (.exe for 64-bit x64 & 32-bit x86/ia32)"
    ;;
  Linux*)
    DETECTED_OS="linux"
    DETECTED_DESC="Linux (AppImage & deb for x64 & arm64)"
    ;;
  *)
    DETECTED_OS="all"
    DETECTED_DESC="All platforms"
    ;;
esac

TARGET="$DETECTED_OS"
EXPLICIT_TARGET=false
CLEAN_FIRST=false
SKIP_TESTS=false

# 2. Argument parsing (optional overrides)
for arg in "$@"; do
  case "$arg" in
    --mac|-m|mac)
      TARGET="mac"
      EXPLICIT_TARGET=true
      ;;
    --win|-w|win)
      TARGET="win"
      EXPLICIT_TARGET=true
      ;;
    --linux|-l|linux)
      TARGET="linux"
      EXPLICIT_TARGET=true
      ;;
    --all|-a|all)
      TARGET="all"
      EXPLICIT_TARGET=true
      ;;
    --clean|-c)
      CLEAN_FIRST=true
      ;;
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --help|-h)
      echo -e "${BOLD}G1Wiggle Zero-Config Desktop Packaging Utility${NC}"
      echo ""
      echo -e "Usage: ${CYAN}./build.sh${NC} ${DIM}(no flags needed - automatically detects current OS)${NC}"
      echo ""
      echo -e "Optional overrides:"
      echo -e "  ${CYAN}--all, -a${NC}        Cross-compile both macOS and Windows"
      echo -e "  ${CYAN}--mac, -m${NC}        Build macOS DMGs (Apple Silicon arm64 & Intel x64)"
      echo -e "  ${CYAN}--win, -w${NC}        Build Windows EXEs (64-bit x64 & 32-bit x86/ia32)"
      echo -e "  ${CYAN}--linux, -l${NC}      Build Linux packages (AppImage & deb)"
      echo -e "  ${CYAN}--clean, -c${NC}      Clean dist/ and release/ directories before packaging"
      echo -e "  ${CYAN}--skip-tests${NC}     Skip running the Vitest automated test suite"
      echo -e "  ${CYAN}--help, -h${NC}       Show this help documentation"
      exit 0
      ;;
    *)
      echo -e "${YELLOW}Warning: Unknown option '$arg'. Using auto-detected OS ($DETECTED_OS).${NC}"
      ;;
  esac
done

echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}       G1Wiggle — Zero-Config Packaging Engine        ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"

if [ "$EXPLICIT_TARGET" = false ]; then
  echo -e " 🖥️  ${BOLD}Auto-detected OS:${NC} ${GREEN}${BOLD}${UNAME_S}${NC} → Target: ${CYAN}${DETECTED_DESC}${NC}"
  echo -e "     ${DIM}(Running in zero-flag mode - no flags required)${NC}"
else
  echo -e " 🎯 ${BOLD}Target Override:${NC}   ${CYAN}${TARGET}${NC}"
fi

echo -e " ⚡ ${DIM}Node Environment:${NC}  $(node -v)"
echo -e " 📦 ${DIM}Machine Arch:${NC}      $(uname -m)"
echo ""

# 0. Clean if requested
if [ "$CLEAN_FIRST" = true ]; then
  echo -e "${CYAN}🧹 [1/5] Cleaning previous build outputs...${NC}"
  rm -rf dist release .icon-tmp
  echo -e "   ✓ Cleaned dist/ and release/"
else
  echo -e "${CYAN}⏩ [1/5] Preserving build caches (use --clean to wipe)...${NC}"
fi

# 1. Generate multi-resolution icons (.icns, .ico, .png)
echo -e "${CYAN}🎨 [2/5] Generating branded desktop icons...${NC}"
node scripts/generate-icons.mjs

# 2. Run automated test suite
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${CYAN}🧪 [3/5] Validating test suite with Vitest...${NC}"
  npm run test
else
  echo -e "${YELLOW}⏩ [3/5] Skipping test suite (--skip-tests active)${NC}"
fi

# 3. Build web production bundle (Vite singlefile)
echo -e "${CYAN}⚡ [4/5] Compiling production web bundle (Vite)...${NC}"
npm run build

# 4. Package desktop releases via electron-builder
echo -e "${CYAN}📦 [5/5] Packaging desktop binaries with electron-builder...${NC}"

case "$TARGET" in
  mac)
    echo -e "   → Building macOS DMGs (Apple Silicon arm64 + Intel x64)..."
    npx electron-builder --mac --config electron-builder.json
    ;;
  win)
    echo -e "   → Building Windows EXEs (64-bit x64 + 32-bit ia32/x86)..."
    npx electron-builder --win --config electron-builder.json
    ;;
  linux)
    echo -e "   → Building Linux packages (AppImage + deb)..."
    npx electron-builder --linux --config electron-builder.json
    ;;
  all)
    echo -e "   → Building macOS DMGs (arm64 + x64)..."
    npx electron-builder --mac --config electron-builder.json
    echo -e "   → Building Windows EXEs (x64 + ia32/x86)..."
    npx electron-builder --win --config electron-builder.json
    ;;
esac

echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}       Packaging Completed Successfully!             ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${BOLD}Generated Artifacts in release/:${NC}"
echo ""

if [ -d "release" ]; then
  ls -lh release/*.dmg release/*.exe release/*.AppImage release/*.deb release/*.zip 2>/dev/null || ls -lh release/
fi

echo ""
echo -e "${CYAN}Desktop packages are ready in:${NC} ${BOLD}${SCRIPT_DIR}/release/${NC}"
echo ""
