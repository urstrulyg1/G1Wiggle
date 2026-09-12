#!/usr/bin/env node
/**
 * G1Wiggle — Desktop Icon Asset Generator
 *
 * Generates:
 *  - build/icon.png (1024x1024 & 512x512)
 *  - build/icon.icns (macOS multi-resolution iconset)
 *  - build/icon.ico (Windows multi-resolution icon resource)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicSvg = path.join(rootDir, "public", "icon.svg");
const buildDir = path.join(rootDir, "build");
const tmpDir = path.join(rootDir, ".icon-tmp");

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

console.log("🎨 [G1Wiggle] Generating desktop icon assets from public/icon.svg...");

if (!fs.existsSync(publicSvg)) {
  console.error(`❌ Source icon not found at: ${publicSvg}`);
  process.exit(1);
}

// Clean temporary folder
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

try {
  // 1. Render master 1024x1024 PNG from SVG using macOS QuickLook
  const masterPng = path.join(tmpDir, "master-1024.png");
  execSync(`qlmanage -t -s 1024 -o "${tmpDir}" "${publicSvg}" >/dev/null 2>&1`);
  const generatedMaster = path.join(tmpDir, "icon.svg.png");
  if (!fs.existsSync(generatedMaster)) {
    throw new Error("Failed to render 1024x1024 master PNG from SVG.");
  }
  fs.copyFileSync(generatedMaster, masterPng);

  // 2. Save 512x512 PNG to build/icon.png
  const buildPng512 = path.join(buildDir, "icon.png");
  execSync(`sips -z 512 512 "${masterPng}" --out "${buildPng512}" >/dev/null 2>&1`);
  console.log("  ✓ Generated build/icon.png (512x512)");

  // 3. Generate macOS .icns using iconutil
  const iconsetDir = path.join(tmpDir, "icon.iconset");
  fs.mkdirSync(iconsetDir, { recursive: true });

  const icnsSizes = [
    { size: 16, name: "icon_16x16.png" },
    { size: 32, name: "icon_16x16@2x.png" },
    { size: 32, name: "icon_32x32.png" },
    { size: 64, name: "icon_32x32@2x.png" },
    { size: 128, name: "icon_128x128.png" },
    { size: 256, name: "icon_128x128@2x.png" },
    { size: 256, name: "icon_256x256.png" },
    { size: 512, name: "icon_256x256@2x.png" },
    { size: 512, name: "icon_512x512.png" },
    { size: 1024, name: "icon_512x512@2x.png" },
  ];

  for (const s of icnsSizes) {
    execSync(`sips -z ${s.size} ${s.size} "${masterPng}" --out "${path.join(iconsetDir, s.name)}" >/dev/null 2>&1`);
  }

  const buildIcns = path.join(buildDir, "icon.icns");
  execSync(`iconutil -c icns "${iconsetDir}" -o "${buildIcns}"`);
  console.log("  ✓ Generated build/icon.icns (multi-res Apple iconset)");

  // 4. Generate Windows .ico (embedding 16, 32, 48, 64, 128, 256 PNGs into standard ICO container)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoPngEntries = [];

  for (const size of icoSizes) {
    const pngPath = path.join(tmpDir, `ico-${size}.png`);
    execSync(`sips -z ${size} ${size} "${masterPng}" --out "${pngPath}" >/dev/null 2>&1`);
    icoPngEntries.push({ size, buffer: fs.readFileSync(pngPath) });
  }

  const count = icoPngEntries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4); // count of images

  let currentOffset = 6 + count * 16;
  const dirEntries = [];
  const imageBuffers = [];

  for (const item of icoPngEntries) {
    imageBuffers.push(item.buffer);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 0); // width (0 = 256)
    entry.writeUInt8(item.size >= 256 ? 0 : item.size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // image offset in file
    currentOffset += item.buffer.length;
    dirEntries.push(entry);
  }

  const finalIcoBuffer = Buffer.concat([header, ...dirEntries, ...imageBuffers]);
  const buildIco = path.join(buildDir, "icon.ico");
  fs.writeFileSync(buildIco, finalIcoBuffer);
  console.log("  ✓ Generated build/icon.ico (Windows 16-256 multi-icon)");

  console.log("✅ [G1Wiggle] Icon generation completed successfully.");
} finally {
  // Clean temporary directory
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
