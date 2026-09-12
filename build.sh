#!/usr/bin/env bash
# ==============================================================================
# G1Wiggle — Desktop Release Packaging Script
# 
# Builds:
#   - macOS Disk Images (.dmg): Apple Silicon (arm64) & Intel (x64)
#   - Windows Executables (.exe): 64-bit (x64) & 32-bit (x86 / ia32)
#
# Usage:
#   ./build.sh          # Builds both macOS (.dmg) and Windows (.exe)
#   ./build.sh --all    # Builds both macOS (.dmg) and Windows (.exe)
#   ./build.sh --mac    # Builds macOS .dmg (arm64 and x64)
#   ./build.sh --win    # Builds Windows .exe (x64 and ia32)
#   ./build.sh --clean  # Cleans previous dist and release folders before build
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

TARGET="all"
CLEAN_FIRST=false
SKIP_TESTS=false

# Argument parsing
for arg in "$@"; do
  case "$arg" in
    --mac|-m|mac)
      TARGET="mac"
      ;;
    --win|-w|win)
      TARGET="win"
      ;;
    --all|-a|all)
      TARGET="all"
      ;;
    --clean|-c)
      CLEAN_FIRST=true
      ;;
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --help|-h)
      echo -e "${BOLD}G1Wiggle Build & Packaging Utility${NC}"
      echo ""
      echo -e "Usage: ./build.sh [TARGET] [OPTIONS]"
      echo ""
      echo -e "Targets:"
      echo -e "  ${CYAN}all, --all, -a${NC}    Build macOS DMGs (arm64, x64) and Windows EXEs (x64, ia32) [default]"
      echo -e "  ${CYAN}mac, --mac, -m${NC}    Build macOS DMGs only (Apple Silicon arm64 & Intel x64)"
      echo -e "  ${CYAN}win, --win, -w${NC}    Build Windows EXEs only (64-bit x64 & 32-bit x86/ia32)"
      echo ""
      echo -e "Options:"
      echo -e "  ${CYAN}--clean, -c${NC}       Clean dist/ and release/ directories before packaging"
      echo -e "  ${CYAN}--skip-tests${NC}      Skip running the Vitest automated test suite"
      echo -e "  ${CYAN}--help, -h${NC}        Show this help documentation"
      exit 0
      ;;
    *)
      echo -e "${YELLOW}Warning: Unknown argument '$arg'. Proceeding with default target 'all'.${NC}"
      ;;
  esac
done

echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}       G1Wiggle — Desktop Packaging Engine           ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e " ${DIM}Target:${NC} ${BOLD}${TARGET}${NC}"
echo -e " ${DIM}Node:${NC}   $(node -v)"
echo -e " ${DIM}Host:${NC}   $(uname -s) $(uname -m)"
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
    echo -e "   → Building macOS DMGs (arm64 + x64)..."
    npx electron-builder --mac --config electron-builder.json
    ;;
  win)
    echo -e "   → Building Windows EXEs (x64 + ia32/x86)..."
    npx electron-builder --win --config electron-builder.json
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
  ls -lh release/*.dmg release/*.exe release/*.zip 2>/dev/null || ls -lh release/
fi

echo ""
echo -e "${CYAN}All requested desktop binaries are ready for distribution in:${NC} ${BOLD}${SCRIPT_DIR}/release/${NC}"
echo ""
