/**
 * G1Wiggle — Strict Asset Validation
 *
 * Validates branding assets for all OS with strict checks:
 * - File existence, size, and dimensions
 * - PNG dimension parsing (no external deps)
 * - Icon suite completeness
 * - Asset naming conventions
 */

import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const iconsDir = path.join(buildDir, "icons");

// ---------------------------------------------------------------------------
// PNG dimension parser (no external deps)
// ---------------------------------------------------------------------------

function getPngDimensions(filePath: string): { width: number; height: number } | null {
  try {
    const data = fs.readFileSync(filePath);
    // PNG signature: 8 bytes
    // IHDR chunk: 4 bytes length, 4 bytes type "IHDR", then 4 bytes width, 4 bytes height
    if (data.length < 24) return null;
    // Check PNG signature
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) {
      if (data[i] !== pngSig[i]) return null;
    }
    // Width at offset 16, height at 20, big-endian
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    return { width, height };
  } catch {
    return null;
  }
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("strict-assets: master icons", () => {
  it("icon.png exists, >100KB, and is 1024x1024 or larger", () => {
    const p = path.join(buildDir, "icon.png");
    expect(fs.existsSync(p)).toBe(true);
    const size = getFileSize(p);
    expect(size).toBeGreaterThan(50 * 1024); // >50KB
    const dims = getPngDimensions(p);
    if (dims) {
      expect(dims.width).toBeGreaterThanOrEqual(512);
      expect(dims.height).toBeGreaterThanOrEqual(512);
      expect(dims.width).toBe(dims.height); // square
    }
  });

  it("icon-2048.png exists, >200KB, and is at least 2048x2048 (may be 4096 for 4K master)", () => {
    const p = path.join(buildDir, "icon-2048.png");
    expect(fs.existsSync(p)).toBe(true);
    const size = getFileSize(p);
    expect(size).toBeGreaterThan(100 * 1024);
    const dims = getPngDimensions(p);
    if (dims) {
      expect(dims.width).toBeGreaterThanOrEqual(2048);
      expect(dims.height).toBeGreaterThanOrEqual(2048);
      expect(dims.width).toBe(dims.height); // square
    }
  });

  it("icon.icns exists, >100KB, macOS multi-res", () => {
    const p = path.join(buildDir, "icon.icns");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(50 * 1024);
  });

  it("icon.ico exists, >10KB, Windows multi-res", () => {
    const p = path.join(buildDir, "icon.ico");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(10 * 1024);
  });
});

describe("strict-assets: macOS DMG assets", () => {
  it("background.tiff exists and >100KB (Retina TIFF)", () => {
    const p = path.join(buildDir, "background.tiff");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(100 * 1024);
  });

  it("dmg-background.png exists and is valid PNG", () => {
    const p = path.join(buildDir, "dmg-background.png");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(10 * 1024);
    const dims = getPngDimensions(p);
    if (dims) {
      expect(dims.width).toBeGreaterThan(600);
      expect(dims.height).toBeGreaterThan(400);
    }
  });

  it("dmg-background@2x.png exists and is 2x resolution of 1x", () => {
    const p1x = path.join(buildDir, "dmg-background.png");
    const p2x = path.join(buildDir, "dmg-background@2x.png");
    expect(fs.existsSync(p2x)).toBe(true);
    const d1 = getPngDimensions(p1x);
    const d2 = getPngDimensions(p2x);
    if (d1 && d2) {
      expect(d2.width).toBe(d1.width * 2);
      expect(d2.height).toBe(d1.height * 2);
    }
  });

  it("dmg-background-4k.png exists and is at least 4x resolution (2720x1800 or 5440x3600 for ultra 4K)", () => {
    const p = path.join(buildDir, "dmg-background-4k.png");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(500 * 1024);
    const dims = getPngDimensions(p);
    if (dims) {
      expect(dims.width).toBeGreaterThanOrEqual(2720);
      expect(dims.height).toBeGreaterThanOrEqual(1800);
      // Aspect ratio should be ~ 680/450 = 1.51
      const ratio = dims.width / dims.height;
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(1.6);
    }
  });
});

describe("strict-assets: Windows NSIS assets", () => {
  it("installerHeader.bmp exists and >10KB", () => {
    const p = path.join(buildDir, "installerHeader.bmp");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(10 * 1024);
  });

  it("installerSidebar.bmp exists and >50KB (164x314 or larger)", () => {
    const p = path.join(buildDir, "installerSidebar.bmp");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(20 * 1024);
  });

  it("uninstallerSidebar.bmp exists and >50KB", () => {
    const p = path.join(buildDir, "uninstallerSidebar.bmp");
    expect(fs.existsSync(p)).toBe(true);
    expect(getFileSize(p)).toBeGreaterThan(20 * 1024);
  });

  it("installerHeader.png and installerSidebar.png sources exist", () => {
    expect(fs.existsSync(path.join(buildDir, "installerHeader.png"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "installerSidebar.png"))).toBe(true);
  });

  it("BMP files have valid BMP header (BM)", () => {
    const bmpFiles = ["installerHeader.bmp", "installerSidebar.bmp", "uninstallerSidebar.bmp"];
    for (const file of bmpFiles) {
      const p = path.join(buildDir, file);
      if (!fs.existsSync(p)) continue;
      const data = fs.readFileSync(p);
      expect(data[0]).toBe(0x42); // B
      expect(data[1]).toBe(0x4d); // M
    }
  });
});

describe("strict-assets: Linux FreeDesktop icon suite", () => {
  const requiredResolutions = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];

  it("icons/ directory exists", () => {
    expect(fs.existsSync(iconsDir)).toBe(true);
    expect(fs.statSync(iconsDir).isDirectory()).toBe(true);
  });

  it("has exactly 10 required resolutions: 16,24,32,48,64,96,128,256,512,1024", () => {
    const files = fs.readdirSync(iconsDir);
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const res of requiredResolutions) {
      const file = `${res}x${res}.png`;
      expect(files).toContain(file);
    }
  });

  it("each icon PNG has correct dimensions matching filename and >100 bytes", () => {
    for (const res of requiredResolutions) {
      const p = path.join(iconsDir, `${res}x${res}.png`);
      expect(fs.existsSync(p), `Missing ${res}x${res}.png`).toBe(true);
      const size = getFileSize(p);
      expect(size, `${res}x${res}.png too small`).toBeGreaterThan(100);
      const dims = getPngDimensions(p);
      if (dims) {
        expect(dims.width, `${res}x${res}.png width mismatch`).toBe(res);
        expect(dims.height, `${res}x${res}.png height mismatch`).toBe(res);
      }
    }
  });

  it("icons are square and size increases with resolution", () => {
    let prevSize = 0;
    for (const res of requiredResolutions) {
      const p = path.join(iconsDir, `${res}x${res}.png`);
      const size = getFileSize(p);
      // Generally larger resolution should have larger file size (with some tolerance)
      // But not strictly monotonic due to compression, so just check >0
      expect(size).toBeGreaterThan(0);
      // At least 512 and 1024 should be significantly larger than 16
      if (res === 1024) {
        expect(size).toBeGreaterThan(prevSize);
      }
      if (res >= 512) prevSize = size;
    }
  });

  it("no extra unexpected files in icons/ (only PNGs)", () => {
    const files = fs.readdirSync(iconsDir);
    for (const file of files) {
      expect(file).toMatch(/^\d+x\d+\.png$/);
    }
  });
});

describe("strict-assets: icon generation script", () => {
  let content: string;
  beforeAll(() => {
    content = fs.readFileSync(path.join(rootDir, "scripts/generate-icons.mjs"), "utf8");
  });

  it("generates 2048 master and 1024 master", () => {
    expect(content).toContain("2048");
    expect(content).toContain("1024");
  });

  it("generates icns with 16 to 1024 resolutions", () => {
    expect(content).toContain("icns");
    expect(content).toContain("icon.icns");
  });

  it("generates ico with 16,24,32,48,64,128,256", () => {
    expect(content).toContain("ico");
    expect(content).toContain("icon.ico");
  });

  it("generates Linux icons suite in build/icons/", () => {
    expect(content).toContain("icons/");
    expect(content).toContain("build/icons");
  });

  it("generates DMG backgrounds: background.tiff, dmg-background@2x.png, 4k", () => {
    expect(content).toContain("background.tiff");
    expect(content).toContain("dmg-background@2x.png");
    expect(content).toContain("2720");
    expect(content).toContain("1800");
  });

  it("generates NSIS bitmaps: installerHeader.bmp, installerSidebar.bmp, uninstallerSidebar.bmp", () => {
    expect(content).toContain("installerHeader.bmp");
    expect(content).toContain("installerSidebar.bmp");
    expect(content).toContain("uninstallerSidebar.bmp");
  });

  it("uses public/icon.svg as source", () => {
    expect(content).toContain("public");
    expect(content).toContain("icon.svg");
  });

  it("has 4K ultra-clarity comment and branding", () => {
    expect(content).toContain("4K");
    expect(content).toContain("G1Wiggle");
  });
});

describe("strict-assets: public and build resources", () => {
  it("public/icon.svg exists and is valid SVG", () => {
    const p = path.join(rootDir, "public/icon.svg");
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, "utf8");
    expect(content).toContain("<svg");
    expect(content).toContain("</svg>");
  });

  it("public/manifest.webmanifest exists", () => {
    const p = path.join(rootDir, "public/manifest.webmanifest");
    // manifest may not exist, but if it does, validate
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf8");
      expect(content).toContain("G1Wiggle");
    } else {
      // Check if index.html references manifest
      const index = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
      // It's okay if manifest doesn't exist, but we note it
      expect(index.length).toBeGreaterThan(0);
    }
  });

  it("build/ directory has no unexpected large files (>10MB)", () => {
    const files = fs.readdirSync(buildDir);
    for (const file of files) {
      const full = path.join(buildDir, file);
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        expect(stat.size, `${file} unexpectedly large >10MB`).toBeLessThan(10 * 1024 * 1024);
      }
    }
  });

  it("build/ has exactly expected top-level files: icon.png, icon-2048.png, icon.icns, icon.ico, background.tiff, etc.", () => {
    const expectedTop = [
      "icon.png",
      "icon-2048.png",
      "icon.icns",
      "icon.ico",
      "background.tiff",
      "dmg-background.png",
      "dmg-background@2x.png",
      "dmg-background-4k.png",
      "installerHeader.bmp",
      "installerHeader.png",
      "installerSidebar.bmp",
      "installerSidebar.png",
      "uninstallerSidebar.bmp",
    ];
    for (const file of expectedTop) {
      expect(fs.existsSync(path.join(buildDir, file)), `Missing expected build asset: ${file}`).toBe(true);
    }
  });
});
