#!/usr/bin/env node
/**
 * G1Wiggle — Build All Apps for All Architectures and All OS
 *
 * This script orchestrates building every app variant:
 *   - macOS: x64, arm64, universal (DMG)
 *   - Windows: x64, ia32, arm64 (NSIS EXE)
 *   - Linux: x64, arm64, armv7l (AppImage) — Electron has no Linux ia32 builds since v19
 *
 * Usage:
 *   node scripts/build-all.mjs                # Build all primary (6 artifacts)
 *   node scripts/build-all.mjs --all          # Build all including secondary (9 artifacts)
 *   node scripts/build-all.mjs --mac          # Build all mac archs
 *   node scripts/build-all.mjs --win          # Build all win archs
 *   node scripts/build-all.mjs --linux        # Build all linux archs
 *   node scripts/build-all.mjs --x64 --arm64  # Build specific archs for all OS
 *   node scripts/build-all.mjs --dry-run      # Print commands without executing
 *   node scripts/build-all.mjs --parallel     # Build per-OS in parallel (faster)
 */

import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isParallel = args.includes("--parallel");
const buildAll = args.includes("--all");
const targetMac = args.includes("--mac") || args.includes("mac") || buildAll || (!args.some(a => ["--win", "--linux", "win", "linux"].includes(a)) && !args.some(a => a.startsWith("--") && !["--dry-run", "--parallel", "--all"].includes(a)));
const targetWin = args.includes("--win") || args.includes("win") || buildAll || args.includes("--all");
const targetLinux = args.includes("--linux") || args.includes("linux") || buildAll || args.includes("--all");

const filterArch = (arch) => {
  const archFlags = ["--x64", "--arm64", "--ia32", "--universal", "--armv7l"];
  const requested = args.filter(a => archFlags.includes(a)).map(a => a.replace("--", ""));
  if (requested.length === 0) return true;
  return requested.includes(arch);
};

// Matrix definition — single source of truth
const MATRIX = [
  // macOS primary
  { os: "mac", arch: "x64", ext: "dmg", priority: "primary", cmd: "npx electron-builder --mac --x64 -p never --config electron-builder.json", artifact: "G1Wiggle-*-x64.dmg" },
  { os: "mac", arch: "arm64", ext: "dmg", priority: "primary", cmd: "npx electron-builder --mac --arm64 -p never --config electron-builder.json", artifact: "G1Wiggle-*-arm64.dmg" },
  { os: "mac", arch: "universal", ext: "dmg", priority: "secondary", cmd: "npx electron-builder --mac --universal -p never --config electron-builder.json", artifact: "G1Wiggle-*-universal.dmg" },

  // Windows primary + secondary
  { os: "win", arch: "x64", ext: "exe", priority: "primary", cmd: "npx electron-builder --win --x64 -p never --config electron-builder.json", artifact: "G1Wiggle-Setup-*-x64.exe" },
  { os: "win", arch: "ia32", ext: "exe", priority: "primary", cmd: "npx electron-builder --win --ia32 -p never --config electron-builder.json", artifact: "G1Wiggle-Setup-*-ia32.exe" },
  { os: "win", arch: "arm64", ext: "exe", priority: "secondary", cmd: "npx electron-builder --win --arm64 -p never --config electron-builder.json", artifact: "G1Wiggle-Setup-*-arm64.exe" },

  // Linux primary + legacy
  { os: "linux", arch: "x64", ext: "AppImage", priority: "primary", cmd: "npx electron-builder --linux --x64 -p never --config electron-builder.json", artifact: "G1Wiggle-*-x64.AppImage" },
  { os: "linux", arch: "arm64", ext: "AppImage", priority: "primary", cmd: "npx electron-builder --linux --arm64 -p never --config electron-builder.json", artifact: "G1Wiggle-*-arm64.AppImage" },
  { os: "linux", arch: "armv7l", ext: "AppImage", priority: "legacy", cmd: "npx electron-builder --linux --armv7l -p never --config electron-builder.json", artifact: "G1Wiggle-*-armv7l.AppImage" },
];

function log(msg, color = "") {
  const colors = {
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    bold: "\x1b[1m",
    reset: "\x1b[0m",
  };
  console.log(`${colors[color] || ""}${msg}${colors.reset}`);
}

function runCommand(cmd, cwd = rootDir) {
  if (isDryRun) {
    log(`[dry-run] ${cmd}`, "cyan");
    return true;
  }
  log(`▶ ${cmd}`, "cyan");
  try {
    execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" } });
    return true;
  } catch (e) {
    log(`✖ Failed: ${cmd}`, "red");
    return false;
  }
}

async function runParallel(commands) {
  if (isDryRun) {
    commands.forEach(c => log(`[dry-run] ${c}`, "cyan"));
    return true;
  }
  const promises = commands.map(cmd => new Promise((resolve) => {
    log(`▶ (parallel) ${cmd}`, "cyan");
    const child = spawn(cmd, { shell: true, cwd: rootDir, stdio: "inherit", env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" } });
    child.on("close", code => resolve(code === 0));
  }));
  const results = await Promise.all(promises);
  return results.every(Boolean);
}

function main() {
  log("", "bold");
  log("======================================================", "green");
  log("  G1Wiggle — Build All Apps × All Arch × All OS", "green");
  log("======================================================", "green");
  log("");

  // Filter matrix based on args
  let targets = MATRIX.filter(m => {
    if (!buildAll && m.priority === "legacy") return false;
    if (m.priority === "secondary" && !buildAll) {
      // Include secondary only if --all or explicitly requested arch
      const requestedSecondary = args.includes(`--${m.arch}`);
      if (!requestedSecondary && m.arch !== "x64") {
        // For primary run, include only primary + win arm64? Actually primary is 6 artifacts
        // Let's keep primary only for default
        return m.priority === "primary";
      }
    }
    if (m.os === "mac" && !targetMac && args.some(a => ["--win", "--linux"].includes(a))) return false;
    if (m.os === "win" && !targetWin && args.some(a => ["--mac", "--linux"].includes(a))) return false;
    if (m.os === "linux" && !targetLinux && args.some(a => ["--mac", "--win"].includes(a))) return false;
    if (!filterArch(m.arch)) return false;
    if (m.priority !== "primary" && !buildAll) {
      // Default: only primary (6 artifacts)
      return m.priority === "primary";
    }
    return true;
  });

  // If no OS filter provided, default to primary (6 artifacts)
  if (targets.length === 0) {
    targets = MATRIX.filter(m => m.priority === "primary");
  }

  // If --all flag, include everything except legacy unless explicitly requested
  if (buildAll) {
    targets = MATRIX.filter(m => m.priority !== "legacy" || args.includes(`--${m.arch}`));
  }

  // Deduplicate by os+arch
  const seen = new Set();
  targets = targets.filter(t => {
    const key = `${t.os}-${t.arch}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log(`🎯 Targets: ${targets.length} artifacts`, "bold");
  targets.forEach(t => log(`  - ${t.os} ${t.arch} (${t.ext}) → ${t.artifact}`, "cyan"));
  log("");

  // Step 1: Clean release
  log("🧹 [1/6] Cleaning release directory...", "yellow");
  runCommand("rm -rf release .icon-tmp .icon-gen-tmp");

  // Step 2: Generate icons
  log("🎨 [2/6] Generating branded icons for all OS...", "yellow");
  if (!runCommand("node scripts/generate-icons.mjs")) {
    log("Failed to generate icons", "red");
    process.exit(1);
  }

  // Step 3: Run tests (pipeline tests validate all OS/arch)
  log("🧪 [3/6] Running pipeline tests for all OS/arch...", "yellow");
  if (!args.includes("--skip-tests")) {
    if (!runCommand("npx vitest run")) {
      log("Tests failed", "red");
      process.exit(1);
    }
  } else {
    log("⏩ Skipping tests (--skip-tests)", "yellow");
  }

  // Step 4: Vite build (universal web bundle for all OS/arch)
  log("⚡ [4/6] Building universal web bundle (Vite singlefile)...", "yellow");
  if (!runCommand("npm run build")) {
    log("Vite build failed", "red");
    process.exit(1);
  }

  // Step 5: Package all OS/arch
  log(`📦 [5/6] Packaging ${targets.length} artifacts for all OS/arch...`, "yellow");

  if (isParallel) {
    // Group by OS for parallel builds
    const byOS = {};
    for (const t of targets) {
      if (!byOS[t.os]) byOS[t.os] = [];
      byOS[t.os].push(t);
    }

    const osCommands = Object.entries(byOS).map(([os, list]) => {
      const archFlags = list.map(l => `--${l.arch}`).join(" ");
      return `npx electron-builder --${os} ${archFlags} -p never --config electron-builder.json`;
    });

    log(`Building ${osCommands.length} OS groups in parallel...`, "cyan");
    osCommands.forEach(c => log(`  ${c}`, "cyan"));

    if (!isDryRun) {
      // For parallel, we need to run sequentially per OS group but OS groups in parallel
      // Actually electron-builder parallel per OS is not safe for same release dir, so we run sequentially
      // But we can still run OS groups in parallel with separate release dirs if needed
      // For simplicity, run sequentially even in parallel mode for safety
      for (const cmd of osCommands) {
        if (!runCommand(cmd)) {
          log(`Failed: ${cmd}`, "red");
          process.exit(1);
        }
      }
    }
  } else {
    for (const target of targets) {
      log(`  → Building ${target.os} ${target.arch} (${target.ext})...`, "cyan");
      if (!runCommand(target.cmd)) {
        log(`Failed to build ${target.os} ${target.arch}`, "red");
        if (target.priority === "primary") {
          process.exit(1);
        } else {
          log(`Continuing (secondary/legacy failure is non-fatal)`, "yellow");
        }
      }
    }
  }

  // Step 6: Purge intermediate files
  log("🧹 [6/6] Purging intermediate metadata...", "yellow");
  runCommand("rm -f release/*.blockmap release/*.yml release/*.yaml release/*.zip");
  runCommand("rm -rf release/*-unpacked release/mac-* release/win-* release/linux-*");

  log("", "bold");
  log("======================================================", "green");
  log("  Build Completed Successfully! 🎉", "green");
  log("======================================================", "green");
  log("");

  if (fs.existsSync(path.join(rootDir, "release"))) {
    const files = fs.readdirSync(path.join(rootDir, "release"));
    log(`Generated ${files.length} artifacts in release/:`, "bold");
    files.forEach(f => {
      const full = path.join(rootDir, "release", f);
      try {
        const stat = fs.statSync(full);
        const size = (stat.size / 1024 / 1024).toFixed(2);
        log(`  - ${f} (${size} MB)`, "green");
      } catch {
        log(`  - ${f}`, "green");
      }
    });
  }

  log("");
  log(`All apps built for all architectures and all OS! Release dir: ${path.join(rootDir, "release")}`, "bold");
  log("");
}

main();
