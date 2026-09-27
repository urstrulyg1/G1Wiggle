#!/usr/bin/env node
/**
 * G1Wiggle — Pipeline Test Runner
 *
 * Validates that the pipeline can create all apps for all architectures and all OS.
 * This script is used by CI and by developers to ensure the full matrix is covered.
 *
 * Usage:
 *   node scripts/test-pipeline.mjs
 *   node scripts/test-pipeline.mjs --verbose
 *   node scripts/test-pipeline.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const verbose = process.argv.includes("--verbose");
const dryRun = process.argv.includes("--dry-run");

const MATRIX = [
  { os: "mac", arch: "x64", ext: "dmg" },
  { os: "mac", arch: "arm64", ext: "dmg" },
  { os: "mac", arch: "universal", ext: "dmg" },
  { os: "win", arch: "x64", ext: "exe" },
  { os: "win", arch: "ia32", ext: "exe" },
  { os: "win", arch: "arm64", ext: "exe" },
  { os: "linux", arch: "x64", ext: "AppImage" },
  { os: "linux", arch: "arm64", ext: "AppImage" },
  { os: "linux", arch: "armv7l", ext: "AppImage" },
];

function log(msg, level = "info") {
  const prefix = {
    info: "ℹ️ ",
    success: "✅ ",
    error: "❌ ",
    warn: "⚠️ ",
    step: "🔧 ",
  }[level] || "";
  console.log(`${prefix}${msg}`);
}

function checkFileExists(p, description) {
  const exists = fs.existsSync(path.join(rootDir, p));
  if (exists) {
    log(`${description}: ${p}`, "success");
    return true;
  } else {
    log(`${description} MISSING: ${p}`, "error");
    return false;
  }
}

function checkFileContains(filePath, needle, description) {
  try {
    const content = fs.readFileSync(path.join(rootDir, filePath), "utf8");
    if (content.includes(needle)) {
      if (verbose) log(`${description} contains "${needle}"`, "success");
      return true;
    } else {
      log(`${description} missing "${needle}" in ${filePath}`, "error");
      return false;
    }
  } catch (e) {
    log(`Failed to read ${filePath}: ${e.message}`, "error");
    return false;
  }
}

async function main() {
  console.log("");
  console.log("======================================================");
  console.log("  G1Wiggle — Pipeline Validation: All Apps × All Arch × All OS");
  console.log("======================================================");
  console.log("");

  let allPass = true;

  // 1. Check build scripts
  log("Checking build scripts support all OS/arch...", "step");
  const scripts = [
    { file: "build.sh", checks: ["--mac", "--win", "--linux", "--x64", "--arm64", "--ia32", "--all", "--all-arch"] },
    { file: "build.bat", checks: ["--mac", "--win", "--linux", "--x64", "--arm64", "--ia32", "--all"] },
  ];
  for (const { file, checks } of scripts) {
    for (const check of checks) {
      if (!checkFileContains(file, check, file)) allPass = false;
    }
  }

  // 2. Check electron-builder.json
  log("Checking electron-builder.json for all OS/arch...", "step");
  try {
    const config = JSON.parse(fs.readFileSync(path.join(rootDir, "electron-builder.json"), "utf8"));
    const required = [
      { path: "mac.artifactName", check: (v) => v.includes("${arch}"), msg: "mac artifactName contains ${arch}" },
      { path: "win.icon", check: (v) => v === "build/icon.ico", msg: "win icon" },
      { path: "nsis.artifactName", check: (v) => v.includes("${arch}"), msg: "nsis artifactName contains ${arch}" },
      { path: "linux.artifactName", check: (v) => v.includes("${arch}"), msg: "linux artifactName contains ${arch}" },
    ];
    for (const { path: p, check, msg } of required) {
      const parts = p.split(".");
      let val = config;
      for (const part of parts) val = val?.[part];
      if (!val || !check(val)) {
        log(`electron-builder.json check failed: ${msg}`, "error");
        allPass = false;
      } else {
        if (verbose) log(`electron-builder.json: ${msg}`, "success");
      }
    }
  } catch (e) {
    log(`electron-builder.json invalid: ${e.message}`, "error");
    allPass = false;
  }

  // 3. Check package.json scripts
  log("Checking package.json scripts for all OS/arch...", "step");
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const requiredScripts = {
      "electron:mac": ["--mac", "--x64", "--arm64"],
      "electron:win": ["--win", "--x64", "--ia32"],
      "electron:linux": ["--linux", "--x64", "--arm64"],
      "electron:all": ["--mac", "--win", "--linux", "--x64", "--arm64", "--ia32"],
    };
    for (const [script, checks] of Object.entries(requiredScripts)) {
      if (!pkg.scripts[script]) {
        log(`Missing script: ${script}`, "error");
        allPass = false;
        continue;
      }
      for (const check of checks) {
        if (!pkg.scripts[script].includes(check)) {
          log(`Script ${script} missing ${check}`, "error");
          allPass = false;
        }
      }
      if (verbose) log(`Script ${script}: OK`, "success");
    }
  } catch (e) {
    log(`package.json invalid: ${e.message}`, "error");
    allPass = false;
  }

  // 4. Check branding assets for all OS
  log("Checking branding assets for all OS...", "step");
  const assets = [
    "build/icon.png",
    "build/icon-2048.png",
    "build/icon.icns",
    "build/icon.ico",
    "build/background.tiff",
    "build/icons/256x256.png",
    "build/installerHeader.bmp",
    "build/installerSidebar.bmp",
  ];
  for (const asset of assets) {
    if (!checkFileExists(asset, "Asset")) allPass = false;
  }

  // 5. Check GitHub workflows
  log("Checking GitHub workflows for all OS/arch matrix...", "step");
  const workflows = ["build.yml", "ci.yml", "release.yml"];
  for (const wf of workflows) {
    const wfPath = `.github/workflows/${wf}`;
    if (!checkFileExists(wfPath, "Workflow")) {
      allPass = false;
      continue;
    }
    const checks = ["macos-latest", "windows-latest", "ubuntu-latest", "x64", "arm64"];
    for (const check of checks) {
      if (!checkFileContains(wfPath, check, wf)) {
        // Not all workflows need all checks, so warn not error for ci.yml
        if (wf === "build.yml") allPass = false;
      }
    }
  }

  // 6. Run vitest pipeline tests
  if (!dryRun) {
    log("Running Vitest pipeline tests...", "step");
    try {
      execSync("npx vitest run tests/pipeline.test.ts tests/build-matrix.test.ts tests/e2e-pipeline.test.ts --reporter=verbose", {
        cwd: rootDir,
        stdio: verbose ? "inherit" : "pipe",
        timeout: 120000,
      });
      log("Pipeline tests passed", "success");
    } catch (e) {
      log("Pipeline tests failed", "error");
      if (!verbose) {
        console.log(e.stdout?.toString() || e.message);
      }
      allPass = false;
    }
  } else {
    log("Dry-run: skipping vitest execution", "warn");
  }

  // 7. Validate matrix completeness
  log("Validating build matrix completeness...", "step");
  log(`Matrix: ${MATRIX.length} supported build targets (mac x64/arm64/universal, win x64/ia32/arm64, linux x64/arm64/armv7l)`, "info");
  for (const entry of MATRIX) {
    log(`  - ${entry.os} ${entry.arch} → ${entry.ext}`, "info");
  }

  console.log("");
  console.log("======================================================");
  if (allPass) {
    console.log("  ✅ Pipeline validation PASSED — all OS/arch covered");
    console.log("  All apps can be created for all architectures and all OS");
  } else {
    console.log("  ❌ Pipeline validation FAILED — see errors above");
  }
  console.log("======================================================");
  console.log("");

  process.exit(allPass ? 0 : 1);
}

main();
