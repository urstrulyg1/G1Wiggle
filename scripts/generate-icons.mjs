#!/usr/bin/env node
/**
 * G1Wiggle — 4K Ultra-Clarity Desktop Packaging Visual Assets & Icon Generator
 *
 * Generates:
 *  - build/icon-2048.png (2048x2048 4K master asset)
 *  - build/icon.png (1024x1024 master and 512x512)
 *  - build/icons/ (Linux standard XDG multi-resolution icons: 16x16 to 1024x1024)
 *  - build/icon.icns (macOS multi-resolution iconset: 16x16 to 1024x1024 Retina)
 *  - build/icon.ico (Windows multi-resolution icon: 16, 24, 32, 48, 64, 128, 256)
 *  - build/background.tiff & build/dmg-background@2x.png (macOS 4K Retina DMG background)
 *  - build/installerSidebar.bmp & build/uninstallerSidebar.bmp (Windows 4K-supersampled NSIS sidebar)
 *  - build/installerHeader.bmp (Windows 4K-supersampled NSIS header)
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicSvg = path.join(rootDir, "public", "icon.svg");
const buildDir = path.join(rootDir, "build");
const iconsDir = path.join(buildDir, "icons");
const tmpDir = path.join(rootDir, ".icon-gen-tmp");

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

if (!fs.existsSync(publicSvg)) {
  console.error(`❌ Source icon not found at: ${publicSvg}`);
  process.exit(1);
}

// Clean temporary folder
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

console.log("🎨 [G1Wiggle] Generating 4K Ultra-Clarity desktop branding & Linux icon suite...");

const svgSource = fs.readFileSync(publicSvg, "utf8");

// 1. 4K Master Icon Template (2048x2048 native vector)
const icon4kHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 2048px; height: 2048px; background: transparent; overflow: hidden; }
    svg { width: 2048px; height: 2048px; display: block; shape-rendering: geometricPrecision; text-rendering: geometricPrecision; }
  </style>
</head>
<body>
  ${svgSource}
</body>
</html>`;

// 2. 4K DMG Background Template (2160x1520 — 4x of 540x380)
const dmgBg4kHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 2160px;
    height: 1520px;
    background: radial-gradient(circle at 50% 18%, rgba(163, 230, 53, 0.18) 0%, rgba(18, 22, 16, 0.98) 55%, #080B07 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    color: #ECEFE3;
    overflow: hidden;
    position: relative;
    user-select: none;
    -webkit-font-smoothing: antialiased;
  }

  .border-glow {
    position: absolute;
    inset: 0;
    border: 4px solid rgba(255, 255, 255, 0.09);
    pointer-events: none;
  }

  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(to right, rgba(255,255,255,0.025) 2px, transparent 2px),
                      linear-gradient(to bottom, rgba(255,255,255,0.025) 2px, transparent 2px);
    background-size: 80px 80px;
    mask-image: radial-gradient(ellipse at 50% 45%, black 40%, transparent 80%);
  }

  .header {
    position: absolute;
    top: 92px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .logo-box {
    width: 168px;
    height: 168px;
    border-radius: 40px;
    background: linear-gradient(135deg, #1C2317 0%, #0D110B 100%);
    border: 3px solid rgba(163, 230, 53, 0.45);
    box-shadow: 0 24px 72px rgba(0, 0, 0, 0.65), 0 0 48px rgba(163, 230, 53, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 28px;
  }

  .logo-box svg {
    width: 120px;
    height: 120px;
  }

  .title {
    font-size: 88px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #FFFFFF;
    text-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  }

  .title span {
    color: #A3E635;
  }

  .subtitle {
    margin-top: 12px;
    font-size: 40px;
    font-weight: 500;
    color: #B4BCA7;
    letter-spacing: -0.015em;
  }

  /* Pedestals centered at (520, 880) and (1640, 880) in 4K — matching 130 and 410 at 220 */
  .pedestal {
    position: absolute;
    width: 352px;
    height: 352px;
    border-radius: 72px;
    top: 880px;
    transform: translate(-50%, -50%);
  }

  .pedestal-left {
    left: 520px;
    border: 4px dashed rgba(163, 230, 53, 0.45);
    background: radial-gradient(circle, rgba(163, 230, 53, 0.12) 0%, transparent 70%);
  }

  .pedestal-right {
    left: 1640px;
    border: 4px dashed rgba(255, 255, 255, 0.28);
    background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  }

  .arrow-container {
    position: absolute;
    left: 780px;
    top: 810px;
    width: 600px;
    height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .footer-pill {
    position: absolute;
    bottom: 92px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 32, 23, 0.9);
    border: 2px solid rgba(163, 230, 53, 0.35);
    backdrop-filter: blur(24px);
    border-radius: 9999px;
    padding: 24px 64px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  .footer-text {
    font-size: 38px;
    font-weight: 600;
    color: #E2E8DC;
    letter-spacing: -0.01em;
  }

  .footer-badge {
    background: #A3E635;
    color: #0E1408;
    font-size: 26px;
    font-weight: 800;
    padding: 6px 20px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
  <div class="border-glow"></div>
  <div class="grid-pattern"></div>

  <div class="header">
    <div class="logo-box">
      ${svgSource}
    </div>
    <h1 class="title">G1<span>Wiggle</span></h1>
    <p class="subtitle">Modern Cursor Automation &amp; Workstation Keep-Alive</p>
  </div>

  <div class="pedestal pedestal-left"></div>
  <div class="pedestal pedestal-right"></div>

  <div class="arrow-container">
    <svg width="600" height="140" viewBox="0 0 600 140" fill="none">
      <defs>
        <linearGradient id="arrow-grad-4k" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#84CC16" stop-opacity="0.4"/>
          <stop offset="60%" stop-color="#A3E635"/>
          <stop offset="100%" stop-color="#BEF264"/>
        </linearGradient>
        <filter id="arrow-glow-4k" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="10" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path d="M 40 70 C 120 30, 200 110, 300 70 S 460 50, 500 70" stroke="url(#arrow-grad-4k)" stroke-width="12" stroke-linecap="round" fill="none" filter="url(#arrow-glow-4k)"/>
      <path d="M 490 44 L 550 70 L 490 96 Z" fill="#BEF264" filter="url(#arrow-glow-4k)"/>
    </svg>
  </div>

  <div class="footer-pill">
    <span class="footer-badge">Install</span>
    <span class="footer-text">Drag G1Wiggle into Applications</span>
  </div>
</body>
</html>`;

// 3. 4K-supersampled NSIS Sidebar (656x1256 — 4x of 164x314)
const sidebar4kHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 656px;
    height: 1256px;
    background: linear-gradient(175deg, #182014 0%, #0D120A 40%, #070906 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    color: #ECEFE3;
    overflow: hidden;
    position: relative;
    padding: 72px 56px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    -webkit-font-smoothing: antialiased;
  }
  .glow {
    position: absolute;
    top: -100px;
    left: -100px;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(163, 230, 53, 0.25) 0%, transparent 70%);
    pointer-events: none;
  }
  .logo-box {
    width: 152px;
    height: 152px;
    border-radius: 36px;
    background: linear-gradient(135deg, #1C2417 0%, #0D110B 100%);
    border: 3px solid rgba(163, 230, 53, 0.45);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 32px rgba(163, 230, 53, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 40px;
  }
  .logo-box svg { width: 112px; height: 112px; }
  .title {
    font-size: 64px;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: -0.02em;
  }
  .title span { color: #A3E635; }
  .desc {
    margin-top: 20px;
    font-size: 32px;
    line-height: 1.4;
    color: #A8B29C;
    font-weight: 450;
  }
  .footer {
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    padding-top: 36px;
  }
  .badge {
    display: inline-block;
    background: rgba(163, 230, 53, 0.14);
    border: 2px solid rgba(163, 230, 53, 0.35);
    color: #BEF264;
    font-size: 24px;
    font-weight: 700;
    padding: 8px 20px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .footer-text {
    margin-top: 16px;
    font-size: 26px;
    color: #8B9480;
  }
</style>
</head>
<body>
  <div class="glow"></div>
  <div>
    <div class="logo-box">${svgSource}</div>
    <h1 class="title">G1<span>Wiggle</span></h1>
    <p class="desc">Hardware &amp; OS Native Cursor Automation Platform</p>
  </div>
  <div class="footer">
    <span class="badge">Verified Native</span>
    <p class="footer-text">Keep-Alive &bull; Smart Profiles &bull; Multi-OS</p>
  </div>
</body>
</html>`;

// 4. 4K-supersampled NSIS Header (600x228 — 4x of 150x57)
const header4kHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 600px;
    height: 228px;
    background: linear-gradient(90deg, #131A10 0%, #0B0E09 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    color: #ECEFE3;
    overflow: hidden;
    padding: 32px 40px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 32px;
    -webkit-font-smoothing: antialiased;
  }
  .text-side {
    text-align: right;
  }
  .title {
    font-size: 40px;
    font-weight: 800;
    color: #FFFFFF;
  }
  .title span { color: #A3E635; }
  .sub {
    font-size: 26px;
    color: #A8B29C;
    margin-top: 4px;
  }
  .logo-box {
    width: 104px;
    height: 104px;
    border-radius: 24px;
    background: #182014;
    border: 2px solid rgba(163, 230, 53, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .logo-box svg { width: 80px; height: 80px; }
</style>
</head>
<body>
  <div class="text-side">
    <div class="title">G1<span>Wiggle</span></div>
    <div class="sub">Setup Wizard</div>
  </div>
  <div class="logo-box">${svgSource}</div>
</body>
</html>`;

// Runner script for Electron
const runnerScript = `
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const iconHtml = ${JSON.stringify(icon4kHtml)};
const dmgBgHtml = ${JSON.stringify(dmgBg4kHtml)};
const sidebarHtml = ${JSON.stringify(sidebar4kHtml)};
const headerHtml = ${JSON.stringify(header4kHtml)};

app.whenReady().then(async () => {
  const tmp = "${tmpDir.replace(/\\/g, "/")}";

  const win = new BrowserWindow({
    width: 2048,
    height: 2048,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  });

  // 1. Render 4K Master Icon (2048x2048)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(iconHtml));
  await new Promise(r => setTimeout(r, 250));
  let img = await win.capturePage();
  fs.writeFileSync(path.join(tmp, 'master-2048.png'), img.toPNG());

  // 2. Render 4K DMG Background (2160x1520)
  win.setContentSize(2160, 1520);
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(dmgBgHtml));
  await new Promise(r => setTimeout(r, 350));
  img = await win.capturePage();
  fs.writeFileSync(path.join(tmp, 'dmg-bg-4k.png'), img.toPNG());

  // 3. Render 4K-supersampled NSIS Sidebar (656x1256)
  win.setContentSize(656, 1256);
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(sidebarHtml));
  await new Promise(r => setTimeout(r, 250));
  img = await win.capturePage();
  fs.writeFileSync(path.join(tmp, 'sidebar-4k.png'), img.toPNG());

  // 4. Render 4K-supersampled NSIS Header (600x228)
  win.setContentSize(600, 228);
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(headerHtml));
  await new Promise(r => setTimeout(r, 250));
  img = await win.capturePage();
  fs.writeFileSync(path.join(tmp, 'header-4k.png'), img.toPNG());

  win.destroy();
  app.quit();
});
`;

const runnerScriptPath = path.join(tmpDir, "render-all.cjs");
fs.writeFileSync(runnerScriptPath, runnerScript);

try {
  const electronBin = path.join(rootDir, "node_modules", ".bin", "electron");
  execFileSync(electronBin, [runnerScriptPath], { stdio: "inherit" });

  // 3. Post-process with Python PIL for pristine Lanczos supersampling
  const pythonScript = `
import os, subprocess
from PIL import Image

tmp = r"${tmpDir}"
build = r"${buildDir}"
icons = r"${iconsDir}"

# 1. Master Icons
master_2048 = Image.open(os.path.join(tmp, "master-2048.png"))
master_2048.save(os.path.join(build, "icon-2048.png"))

master_1024 = master_2048.resize((1024, 1024), Image.Resampling.LANCZOS)
master_1024.save(os.path.join(build, "icon.png"))

# 2. Linux multi-resolution icon suite in build/icons/
linux_icon_sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024]
for sz in linux_icon_sizes:
    target_path = os.path.join(icons, f"{sz}x{sz}.png")
    resized = master_2048.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(target_path)

# 3. macOS .icns multi-resolution bundle (Retina 4K ready)
iconset_dir = os.path.join(tmp, "icon.iconset")
os.makedirs(iconset_dir, exist_ok=True)
icns_specs = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]
for filename, sz in icns_specs:
    resized = master_2048.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(os.path.join(iconset_dir, filename))

icns_out = os.path.join(build, "icon.icns")
subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", icns_out], check=True)

# 4. Windows .ico multi-resolution container
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_out = os.path.join(build, "icon.ico")
master_1024.save(ico_out, format="ICO", sizes=ico_sizes)

# 5. 4K DMG Background (540x380 1x and 1080x760 2x Retina TIFF supersampled from 2160x1520)
dmg_4k = Image.open(os.path.join(tmp, "dmg-bg-4k.png")).convert("RGB")
dmg_4k.save(os.path.join(build, "dmg-background-4k.png"))

dmg_2x = dmg_4k.resize((1080, 760), Image.Resampling.LANCZOS)
dmg_2x_path = os.path.join(build, "dmg-background@2x.png")
dmg_2x.save(dmg_2x_path)

dmg_1x = dmg_4k.resize((540, 380), Image.Resampling.LANCZOS)
dmg_1x_path = os.path.join(build, "dmg-background.png")
dmg_1x.save(dmg_1x_path)

tiff_out = os.path.join(build, "background.tiff")
subprocess.run(["tiffutil", "-cathidpicheck", dmg_1x_path, dmg_2x_path, "-out", tiff_out], check=True)

# 6. Windows NSIS BMP graphics supersampled from 4x renders
sidebar_4k = Image.open(os.path.join(tmp, "sidebar-4k.png")).convert("RGB")
sidebar_1x = sidebar_4k.resize((164, 314), Image.Resampling.LANCZOS)
sidebar_1x.save(os.path.join(build, "installerSidebar.bmp"), format="BMP")
sidebar_1x.save(os.path.join(build, "uninstallerSidebar.bmp"), format="BMP")
sidebar_1x.save(os.path.join(build, "installerSidebar.png"), format="PNG")

header_4k = Image.open(os.path.join(tmp, "header-4k.png")).convert("RGB")
header_1x = header_4k.resize((150, 57), Image.Resampling.LANCZOS)
header_1x.save(os.path.join(build, "installerHeader.bmp"), format="BMP")
header_1x.save(os.path.join(build, "installerHeader.png"), format="PNG")

print("4K Asset processing and Linux icon generation complete.")
`;

  execFileSync("python3", ["-c", pythonScript], { stdio: "inherit" });

  console.log("  ✓ Generated build/icon-2048.png (4K Ultra HD master icon)");
  console.log("  ✓ Generated build/icon.png (1024x1024 master icon)");
  console.log("  ✓ Generated build/icons/ (10 standard Linux XDG icon resolutions: 16x16 to 1024x1024)");
  console.log("  ✓ Generated build/icon.icns (Apple Retina multi-resolution)");
  console.log("  ✓ Generated build/icon.ico (Windows multi-resolution 16-256)");
  console.log("  ✓ Generated build/dmg-background-4k.png & build/background.tiff (4K-supersampled macOS DMG background)");
  console.log("  ✓ Generated build/installerSidebar.bmp (4K-supersampled Windows NSIS installer sidebar)");
  console.log("  ✓ Generated build/uninstallerSidebar.bmp (4K-supersampled Windows NSIS uninstaller sidebar)");
  console.log("  ✓ Generated build/installerHeader.bmp (4K-supersampled Windows NSIS installer header)");
  console.log("✅ [G1Wiggle] All 4K ultra-clarity packaging brand assets generated successfully.");
} finally {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
