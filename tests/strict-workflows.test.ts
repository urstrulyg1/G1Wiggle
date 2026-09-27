/**
 * G1Wiggle — Strict GitHub Actions workflow validation.
 * The supported production matrix is exactly seven targets:
 * Linux x64/arm64, macOS x64/arm64/universal, Windows x64/ia32.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const rootDir = path.resolve(__dirname, "..");
const workflowsDir = path.join(rootDir, ".github/workflows");

function readWorkflow(name: string): string {
  return fs.readFileSync(path.join(workflowsDir, name), "utf8");
}

const SUPPORTED_TARGETS = [
  "mac/x64",
  "mac/arm64",
  "mac/universal",
  "win/x64",
  "win/ia32",
  "linux/x64",
  "linux/arm64",
];

describe("strict-workflows: workflow set", () => {
  it("has only the dedicated build and release workflows", () => {
    expect(fs.existsSync(path.join(workflowsDir, "build.yml"))).toBe(true);
    expect(fs.existsSync(path.join(workflowsDir, "release.yml"))).toBe(true);
    expect(fs.existsSync(path.join(workflowsDir, "ci.yml"))).toBe(false);
  });

  it("workflow files have jobs and triggers", () => {
    for (const file of ["build.yml", "release.yml"]) {
      const content = readWorkflow(file);
      expect(content.length).toBeGreaterThan(1024);
      expect(content).toContain("name:");
      expect(content).toContain("on:");
      expect(content).toContain("jobs:");
    }
  });
});

describe("strict-workflows: build matrix", () => {
  const content = readWorkflow("build.yml");

  it("runs only push CI on supported branches with stale-run cancellation", () => {
    expect(content).toContain("push:");
    expect(content).not.toContain("pull_request:");
    expect(content).not.toContain("workflow_dispatch:");
    expect(content).toContain("g1wiggle-ci-${{ github.workflow }}-${{ github.ref }}");
    expect(content).toContain("cancel-in-progress: true");
  });

  it("uses Node 22.12.0 and npm caching", () => {
    expect(content).toContain('CI_NODE_VERSION: "22.12.0"');
    expect(content).toContain("actions/setup-node@v7");
    expect(content).toContain("node-version: ${{ env.CI_NODE_VERSION }}");
    expect(content).toContain("cache: npm");
    expect(content).not.toContain("node-version: 20");
  });

  it("defines exactly seven matrix targets", () => {
    for (const target of SUPPORTED_TARGETS) {
      const [os, arch] = target.split("/");
      expect(content).toContain(`os: ${os}, arch: ${arch}`);
    }
    expect((content.match(/- \{ os:/g) || []).length).toBe(7);
    expect(content).not.toContain("arch: arm64, runner: windows");
    expect(content).not.toContain("arch: armv7l");
  });

  it("uses independent parallel matrix execution", () => {
    expect(content).toContain("fail-fast: false");
    expect(content).toContain("max-parallel: 7");
    expect(content).not.toContain("needs: test");
  });

  it("does not hide failures", () => {
    expect(content).not.toContain("continue-on-error:");
    expect(content).not.toMatch(/\|\|\s*true/);
    expect(content).not.toContain("if: ${{ success() }}");
  });

  it("validates packaging artifacts and uploads failures", () => {
    expect(content).toContain("if-no-files-found: error");
    expect(content).toContain("actions/upload-artifact@v7");
    expect(content).toContain("retention-days: 30");
    expect(content).toContain("Validate exact artifact");
    expect(content).toContain("Validate Windows NSIS installation");
    expect(content).toContain("Validate macOS DMG");
    expect(content).toContain("Validate Linux AppImage");
  });

  it("uses portable artifact size validation", () => {
    expect(content).toContain("wc -c");
    expect(content).not.toContain("stat -c");
  });

  it("uses an X server for Linux Electron smoke tests", () => {
    expect(content).toContain("xvfb-run --auto-servernum");
  });

  it("has no Windows ARM64 or Linux ARMv7 matrix entries", () => {
    expect(content).not.toContain("windows-11-arm");
    expect(content).not.toContain("--win --arm64");
    expect(content).not.toContain("armv7l");
  });
});

describe("strict-workflows: release matrix", () => {
  const content = readWorkflow("release.yml");

  it("uses Node 22 and npm cache", () => {
    expect(content).toContain('CI_NODE_VERSION: "22.12.0"');
    expect(content).toContain("actions/setup-node@v7");
    expect(content).toContain("cache: npm");
    expect(content).not.toContain("node-version: 20");
  });

  it("contains exactly seven release targets", () => {
    expect((content.match(/- \{ os:/g) || []).length).toBe(7);
    expect(content).not.toContain("windows-11-arm");
    expect(content).not.toContain("armv7l");
    expect(content).toContain("test ${#files[@]} -eq 7");
  });

  it("does not hide release failures", () => {
    expect(content).not.toContain("continue-on-error:");
    expect(content).not.toMatch(/\|\|\s*true/);
  });

  it("uses portable artifact validation and Linux headless smoke tests", () => {
    expect(content).toContain("wc -c");
    expect(content).not.toContain("stat -c");
    expect(content).toContain("xvfb-run --auto-servernum");
  });
});

describe("strict-workflows: security", () => {
  for (const file of ["build.yml", "release.yml"]) {
    it(`${file} uses current actions and no hardcoded credentials`, () => {
      const content = readWorkflow(file);
      expect(content).toContain("actions/checkout@v7");
      expect(content).toContain("actions/setup-node@v7");
      expect(content).toContain("secrets.GITHUB_TOKEN");
      expect(content).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
      expect(content).not.toMatch(/github_pat_[a-zA-Z0-9_]{82}/);
    });
  }
});
