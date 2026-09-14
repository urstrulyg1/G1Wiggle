import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const iconsDir = path.join(buildDir, "icons");

describe("desktop packaging assets", () => {
  it("has master 4K and 1024 icons", () => {
    expect(fs.existsSync(path.join(buildDir, "icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "icon-2048.png"))).toBe(true);
  });

  it("has macOS multi-resolution icns and Retina TIFF background", () => {
    expect(fs.existsSync(path.join(buildDir, "icon.icns"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "background.tiff"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "dmg-background@2x.png"))).toBe(true);
  });

  it("has Windows multi-resolution ico and NSIS wizard bitmaps", () => {
    expect(fs.existsSync(path.join(buildDir, "icon.ico"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "installerSidebar.bmp"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "installerHeader.bmp"))).toBe(true);
  });

  it("has complete Linux FreeDesktop icon suite in build/icons/", () => {
    const requiredResolutions = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];
    for (const res of requiredResolutions) {
      const file = path.join(iconsDir, `${res}x${res}.png`);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(100);
    }
  });

  it("electron-builder.json has all required branding configurations", () => {
    const configPath = path.join(rootDir, "electron-builder.json");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Mac
    expect(config.mac.icon).toBe("build/icon.icns");
    expect(config.dmg.background).toBe("build/background.tiff");
    expect(config.dmg.icon).toBe("build/icon.icns");

    // Win
    expect(config.win.icon).toBe("build/icon.ico");
    expect(config.nsis.installerIcon).toBe("build/icon.ico");
    expect(config.nsis.installerSidebar).toBe("build/installerSidebar.bmp");
    expect(config.nsis.installerHeader).toBe("build/installerHeader.bmp");

    // Linux
    expect(config.linux.icon).toBe("build/icons");
    expect(typeof config.linux.maintainer).toBe("string");
  });
});
