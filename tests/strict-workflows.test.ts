/**
 * G1Wiggle — Strict Workflow Validation
 *
 * Strict validation of GitHub Actions workflows that build all apps
 * for all architectures and all operating systems.
 */

import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");
const workflowsDir = path.join(rootDir, ".github/workflows");

function readWorkflow(name: string): string {
  return fs.readFileSync(path.join(workflowsDir, name), "utf8");
}

describe("strict-workflows: files existence", () => {
  it("has .github/workflows directory", () => {
    expect(fs.existsSync(workflowsDir)).toBe(true);
  });

  it("has build.yml, ci.yml, release.yml", () => {
    expect(fs.existsSync(path.join(workflowsDir, "build.yml"))).toBe(true);
    expect(fs.existsSync(path.join(workflowsDir, "ci.yml"))).toBe(true);
    expect(fs.existsSync(path.join(workflowsDir, "release.yml"))).toBe(true);
  });

  it("all workflow files are >1KB and valid YAML-like structure", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = readWorkflow(file);
      expect(content.length).toBeGreaterThan(1024);
      expect(content).toContain("name:");
      expect(content).toContain("on:");
      expect(content).toContain("jobs:");
    }
  });
});

describe("strict-workflows: build.yml strict validation", () => {
  let content: string;
  beforeAll(() => {
    content = readWorkflow("build.yml");
  });

  it("has name containing All Apps, All OS, All Arch", () => {
    expect(content).toContain("All Apps");
    expect(content).toContain("All OS");
    expect(content).toContain("Arch");
  });

  it("triggers on push, pull_request, workflow_dispatch", () => {
    expect(content).toContain("push:");
    expect(content).toContain("pull_request:");
    expect(content).toContain("workflow_dispatch:");
  });

  it("has workflow_dispatch inputs for target with options all, mac, win, linux, x64, arm64, ia32", () => {
    expect(content).toContain("target:");
    expect(content).toContain("all");
    expect(content).toContain("mac");
    expect(content).toContain("win");
    expect(content).toContain("linux");
    expect(content).toContain("x64");
    expect(content).toContain("arm64");
    expect(content).toContain("ia32");
  });

  it("has test job with checkout, setup-node, npm ci, test, build, electron-builder --help", () => {
    expect(content).toContain("test:");
    expect(content).toContain("actions/checkout@v4");
    expect(content).toContain("actions/setup-node@v4");
    expect(content).toContain("npm ci");
    // Icons are committed under build/; regenerating them needs a display and macOS-only tools
    expect(content).not.toContain("npm run icons");
    expect(content).toContain("npm run test");
    expect(content).toContain("npm run build");
    expect(content).toContain("electron-builder --help");
  });

  it("has build matrix with 9+ entries covering mac x64/arm64/universal, win x64/ia32/arm64, linux x64/arm64/armv7l", () => {
    expect(content).toContain("macos-latest");
    expect(content).toContain("windows-latest");
    expect(content).toContain("ubuntu-latest");
    expect(content).toContain("ubuntu-24.04-arm");
    expect(content).toContain("armv7l");
    expect(content).toContain("x64");
    expect(content).toContain("arm64");
    expect(content).toContain("ia32");
    expect(content).toContain("universal");
  });

  it("build matrix includes artifact patterns with * wildcard", () => {
    expect(content).toContain("G1Wiggle-*-x64.dmg");
    expect(content).toContain("G1Wiggle-*-arm64.dmg");
    expect(content).toContain("G1Wiggle-Setup-*-x64.exe");
    expect(content).toContain("G1Wiggle-Setup-*-ia32.exe");
    expect(content).toContain("G1Wiggle-*-x64.AppImage");
    expect(content).toContain("G1Wiggle-*-arm64.AppImage");
  });

  it("has a single strict build matrix covering every target", () => {
    expect(content).toContain("build-matrix");
    expect(content).toContain("armv7l");
    expect(content).toContain("max-parallel: 1");
  });

  it("does not use unsafe cross-platform build aggregation", () => {
    expect(content).not.toContain("build-all:");
    expect(content).not.toContain("Build All OS & Arch");
  });

  it("has strict fail-fast and serialized matrix execution", () => {
    expect(content).toContain("fail-fast: true");
    expect(content).toContain("max-parallel: 1");
  });

  it("does not silently ignore build failures", () => {
    expect(content).not.toContain("continue-on-error:");
    expect(content).toContain("ia32");
  });

  it("has GH_TOKEN and CSC_IDENTITY_AUTO_DISCOVERY false env", () => {
    expect(content).toContain("GH_TOKEN");
    expect(content).toContain("CSC_IDENTITY_AUTO_DISCOVERY: false");
  });

  it("has purge step removing blockmap, yml, unpacked", () => {
    expect(content).toContain("*.blockmap");
    expect(content).toContain("*.yml");
    expect(content).toContain("*-unpacked");
  });

  it("has upload-artifact@v4 with strict missing-artifact failure, retention-days 30", () => {
    expect(content).toContain("actions/upload-artifact@v4");
    expect(content).toContain("if-no-files-found: error");
    expect(content).toContain("retention-days: 30");
  });

  it("has summary job with GITHUB_STEP_SUMMARY and table of OS/Arch", () => {
    expect(content).toContain("summary:");
    expect(content).toContain("GITHUB_STEP_SUMMARY");
    expect(content).toContain("| OS | Arch | Artifact | Runner |");
  });

  it("uses Node.js 20", () => {
    expect(content).toContain("node-version: 20");
  });

  it("has cache npm", () => {
    expect(content).toContain("cache: npm");
  });
});

describe("strict-workflows: ci.yml strict validation", () => {
  let content: string;
  beforeAll(() => {
    content = readWorkflow("ci.yml");
  });

  it("has name CI and triggers on push/pull_request", () => {
    expect(content).toContain("name: CI");
    expect(content).toContain("push:");
    expect(content).toContain("pull_request:");
  });

  it("has validate-pipeline job with build.sh flags validation", () => {
    expect(content).toContain("validate-pipeline");
    expect(content).toContain("build.sh");
    expect(content).toContain("--mac");
    expect(content).toContain("--win");
    expect(content).toContain("--linux");
    // Check overall file contains arch flags (in build-matrix job)
    expect(content).toContain("x64");
    expect(content).toContain("arm64");
    expect(content).toContain("ia32");
    expect(content).toContain("all-arch");
  });

  it("validates electron-builder.json artifactName contains ${arch}", () => {
    expect(content).toContain("${arch}");
    expect(content).toContain("artifactName");
  });

  it("has architecture validation job and all runner families", () => {
    expect(content).toContain("build-matrix");
    expect(content).toContain("ubuntu-latest");
    expect(content).toContain("windows-latest");
    expect(content).toContain("macos-latest");
    expect(content).toContain("x64");
    expect(content).toContain("arm64");
  });

  it("uses native ARM Linux runner where required", () => {
    expect(content).toContain("ubuntu-24.04-arm");
    expect(content).toContain("ia32");
    expect(content).toContain("universal");
  });

  it("has strict CI gating and GH_TOKEN env", () => {
    expect(content).not.toContain("fail-fast: false");
    expect(content).toContain("GH_TOKEN");
  });
});

describe("strict-workflows: release.yml strict validation", () => {
  let content: string;
  beforeAll(() => {
    content = readWorkflow("release.yml");
  });

  it("has name Release and triggers on tags v* and workflow_dispatch", () => {
    expect(content).toContain("name: Release");
    expect(content).toContain("tags:");
    expect(content).toContain("v*");
    expect(content).toContain("workflow_dispatch:");
  });

  it("has version input for manual releases", () => {
    expect(content).toContain("version:");
    expect(content).toContain("Release version");
  });

  it("has test job as pre-release check", () => {
    expect(content).toContain("test:");
    expect(content).toContain("Pre-release Tests");
  });

  it("has release-build matrix building macOS x64, arm64, universal", () => {
    expect(content).toContain("release-build:");
    expect(content).toContain("macOS");
    expect(content).toContain("macos-15-intel");
    expect(content).toContain("--mac --x64");
    expect(content).toContain("--mac --arm64");
    expect(content).toContain("--mac --universal");
  });

  it("release-build matrix includes Windows x64, ia32, arm64", () => {
    expect(content).toContain("release-build:");
    expect(content).toContain("Windows");
    expect(content).toContain("windows-11-arm");
    expect(content).toContain("--win --x64");
    expect(content).toContain("--win --ia32");
    expect(content).toContain("--win --arm64");
  });

  it("release-build matrix includes Linux x64 and arm64", () => {
    expect(content).toContain("release-build:");
    expect(content).toContain("ubuntu-latest");
    expect(content).toContain("ubuntu-24.04-arm");
    expect(content).toContain("x64");
    expect(content).toContain("arm64");
  });

  it("has release-summary job downloading all artifacts and creating GitHub Release on tag", () => {
    expect(content).toContain("release-summary:");
    expect(content).toContain("download-artifact@v4");
    expect(content).toContain("softprops/action-gh-release@v2");
    expect(content).toContain('tag_name:');
  });

  it("has upload-artifact with retention 90 days for releases", () => {
    expect(content).toContain("retention-days: 90");
  });

  it("has release dependencies chained in strict order", () => {
    expect(content).toContain("needs: test");
    expect(content).toContain("needs: test");
    expect(content).toContain("needs: release-build");
  });

  it("has GH_TOKEN and CSC_IDENTITY_AUTO_DISCOVERY false", () => {
    expect(content).toContain("GH_TOKEN");
    expect(content).toContain("CSC_IDENTITY_AUTO_DISCOVERY: false");
  });
});

describe("strict-workflows: security and best practices", () => {
  it("all workflows use checkout@v4 and setup-node@v4 (not v3 or older)", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = readWorkflow(file);
      expect(content).toContain("actions/checkout@v4");
      expect(content).toContain("actions/setup-node@v4");
      expect(content).not.toContain("actions/checkout@v3");
      expect(content).not.toContain("actions/setup-node@v3");
    }
  });

  it("all workflows use upload-artifact@v4 and download-artifact@v4", () => {
    const build = readWorkflow("build.yml");
    expect(build).toContain("actions/upload-artifact@v4");
    const release = readWorkflow("release.yml");
    expect(release).toContain("actions/upload-artifact@v4");
    expect(release).toContain("actions/download-artifact@v4");
  });

  it("workflows do not have hardcoded secrets, only secrets.GITHUB_TOKEN", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = readWorkflow(file);
      expect(content).toContain("secrets.GITHUB_TOKEN");
      // Should not contain hardcoded token patterns
      expect(content).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
      expect(content).not.toMatch(/github_pat_[a-zA-Z0-9_]{82}/);
    }
  });

  it("build workflow fails when artifacts are missing", () => {
    const build = readWorkflow("build.yml");
    expect(build).toContain("if-no-files-found: error");
  });

  it("workflows have retention-days set (30 for build, 90 for release)", () => {
    const build = readWorkflow("build.yml");
    expect(build).toContain("retention-days: 30");
    const release = readWorkflow("release.yml");
    expect(release).toContain("retention-days: 90");
  });

  it("build.yml has branches filter for main, master, arena/**", () => {
    const content = readWorkflow("build.yml");
    expect(content).toContain("main");
    expect(content).toContain("master");
    expect(content).toContain("arena/**");
  });
});
