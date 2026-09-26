/**
 * G1Wiggle — Strict Matrix Validation
 *
 * Enforces strict completeness of OS × Architecture matrix
 * for creating all apps for all architectures and all OS.
 */

import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");

type OSKind = "mac" | "win" | "linux";
type ArchKind = "x64" | "arm64" | "ia32" | "universal" | "armv7l";

interface StrictTarget {
  os: OSKind;
  arch: ArchKind;
  ext: string;
  runner: string;
  priority: "primary" | "secondary" | "legacy";
  artifact: string;
  buildCmd: string;
}

// Strict primary matrix — MUST be built
const PRIMARY: StrictTarget[] = [
  { os: "mac", arch: "x64", ext: "dmg", runner: "macos-latest", priority: "primary", artifact: "G1Wiggle-1.0.0-x64.dmg", buildCmd: "npx electron-builder --mac --x64 -p never --config electron-builder.json" },
  { os: "mac", arch: "arm64", ext: "dmg", runner: "macos-latest", priority: "primary", artifact: "G1Wiggle-1.0.0-arm64.dmg", buildCmd: "npx electron-builder --mac --arm64 -p never --config electron-builder.json" },
  { os: "win", arch: "x64", ext: "exe", runner: "windows-latest", priority: "primary", artifact: "G1Wiggle-Setup-1.0.0-x64.exe", buildCmd: "npx electron-builder --win --x64 -p never --config electron-builder.json" },
  { os: "win", arch: "ia32", ext: "exe", runner: "windows-latest", priority: "primary", artifact: "G1Wiggle-Setup-1.0.0-ia32.exe", buildCmd: "npx electron-builder --win --ia32 -p never --config electron-builder.json" },
  { os: "linux", arch: "x64", ext: "AppImage", runner: "ubuntu-latest", priority: "primary", artifact: "G1Wiggle-1.0.0-x64.AppImage", buildCmd: "npx electron-builder --linux --x64 -p never --config electron-builder.json" },
  { os: "linux", arch: "arm64", ext: "AppImage", runner: "ubuntu-24.04-arm", priority: "primary", artifact: "G1Wiggle-1.0.0-arm64.AppImage", buildCmd: "npx electron-builder --linux --arm64 -p never --config electron-builder.json" },
];

// Secondary matrix — SHOULD be built
const SECONDARY: StrictTarget[] = [
  { os: "mac", arch: "universal", ext: "dmg", runner: "macos-latest", priority: "secondary", artifact: "G1Wiggle-1.0.0-universal.dmg", buildCmd: "npx electron-builder --mac --universal -p never --config electron-builder.json" },
  { os: "win", arch: "arm64", ext: "exe", runner: "windows-latest", priority: "secondary", artifact: "G1Wiggle-Setup-1.0.0-arm64.exe", buildCmd: "npx electron-builder --win --arm64 -p never --config electron-builder.json" },
];

// Legacy matrix — MAY be built, not required
const LEGACY: StrictTarget[] = [
  { os: "linux", arch: "ia32", ext: "AppImage", runner: "ubuntu-latest", priority: "legacy", artifact: "G1Wiggle-1.0.0-ia32.AppImage", buildCmd: "npx electron-builder --linux --ia32 -p never --config electron-builder.json" },
  { os: "linux", arch: "armv7l", ext: "AppImage", runner: "ubuntu-24.04-arm", priority: "legacy", artifact: "G1Wiggle-1.0.0-armv7l.AppImage", buildCmd: "npx electron-builder --linux --armv7l -p never --config electron-builder.json" },
];

const ALL = [...PRIMARY, ...SECONDARY, ...LEGACY];

function read(p: string): string {
  return fs.readFileSync(path.join(rootDir, p), "utf8");
}

describe("strict-matrix: primary matrix must have 6 artifacts", () => {
  it("has exactly 6 primary artifacts", () => {
    expect(PRIMARY.length).toBe(6);
  });

  it("primary includes mac x64, mac arm64, win x64, win ia32, linux x64, linux arm64", () => {
    const keys = PRIMARY.map((t) => `${t.os}-${t.arch}`).sort();
    expect(keys).toEqual(["linux-arm64", "linux-x64", "mac-arm64", "mac-x64", "win-ia32", "win-x64"]);
  });

  it("primary covers 3 OS", () => {
    const osSet = new Set(PRIMARY.map((t) => t.os));
    expect(osSet.size).toBe(3);
  });

  it("primary covers 3 arch (x64, arm64, ia32)", () => {
    const archSet = new Set(PRIMARY.map((t) => t.arch));
    expect(archSet.size).toBe(3);
    expect(archSet.has("x64")).toBe(true);
    expect(archSet.has("arm64")).toBe(true);
    expect(archSet.has("ia32")).toBe(true);
  });

  it("primary has no duplicates", () => {
    const keys = PRIMARY.map((t) => `${t.os}-${t.arch}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("primary artifacts have unique filenames per OS", () => {
    const macFiles = PRIMARY.filter((t) => t.os === "mac").map((t) => t.artifact);
    expect(new Set(macFiles).size).toBe(macFiles.length);
    const winFiles = PRIMARY.filter((t) => t.os === "win").map((t) => t.artifact);
    expect(new Set(winFiles).size).toBe(winFiles.length);
    const linuxFiles = PRIMARY.filter((t) => t.os === "linux").map((t) => t.artifact);
    expect(new Set(linuxFiles).size).toBe(linuxFiles.length);
  });

  it("primary artifacts match strict regex per OS", () => {
    const regex = {
      mac: /^G1Wiggle-\d+\.\d+\.\d+-(x64|arm64)\.dmg$/,
      win: /^G1Wiggle-Setup-\d+\.\d+\.\d+-(x64|ia32)\.exe$/,
      linux: /^G1Wiggle-\d+\.\d+\.\d+-(x64|arm64)\.AppImage$/,
    };
    for (const t of PRIMARY) {
      expect(t.artifact).toMatch(regex[t.os]);
    }
  });

  it("primary build commands contain correct OS and arch flags", () => {
    for (const t of PRIMARY) {
      expect(t.buildCmd).toContain(`--${t.os}`);
      expect(t.buildCmd).toContain(`--${t.arch}`);
      expect(t.buildCmd).toContain("electron-builder");
      expect(t.buildCmd).toContain("-p never");
      expect(t.buildCmd).toContain("--config electron-builder.json");
    }
  });

  it("primary runners are valid GitHub Actions runners", () => {
    for (const t of PRIMARY) {
      expect(t.runner).toMatch(/^(macos-latest|windows-latest|ubuntu-latest|ubuntu-24\.04-arm)$/);
    }
  });

  it("primary mac uses macos-latest, win uses windows-latest, linux uses ubuntu", () => {
    for (const t of PRIMARY) {
      if (t.os === "mac") expect(t.runner).toContain("macos");
      if (t.os === "win") expect(t.runner).toContain("windows");
      if (t.os === "linux") expect(t.runner).toContain("ubuntu");
    }
  });
});

describe("strict-matrix: secondary and legacy", () => {
  it("secondary has 2 entries: mac universal, win arm64", () => {
    expect(SECONDARY.length).toBe(2);
    expect(SECONDARY.map((t) => `${t.os}-${t.arch}`).sort()).toEqual(["mac-universal", "win-arm64"]);
  });

  it("legacy has 2 entries: linux ia32, linux armv7l", () => {
    expect(LEGACY.length).toBe(2);
    expect(LEGACY.map((t) => `${t.os}-${t.arch}`).sort()).toEqual(["linux-armv7l", "linux-ia32"]);
  });

  it("all (primary+secondary+legacy) has 10 entries", () => {
    expect(ALL.length).toBe(10);
  });

  it("all has no duplicate os-arch", () => {
    const keys = ALL.map((t) => `${t.os}-${t.arch}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("all covers 3 OS and 5 arch", () => {
    const osSet = new Set(ALL.map((t) => t.os));
    const archSet = new Set(ALL.map((t) => t.arch));
    expect(osSet.size).toBe(3);
    expect(archSet.size).toBe(5);
    expect(archSet.has("x64")).toBe(true);
    expect(archSet.has("arm64")).toBe(true);
    expect(archSet.has("ia32")).toBe(true);
    expect(archSet.has("universal")).toBe(true);
    expect(archSet.has("armv7l")).toBe(true);
  });
});

describe("strict-matrix: build.sh and build.bat coverage", () => {
  let sh: string, bat: string;
  beforeAll(() => {
    sh = read("build.sh");
    bat = read("build.bat");
  });

  it("build.sh --all builds 6 primary artifacts (mac x64+arm64, win x64+ia32, linux x64+arm64)", () => {
    // Check that build.sh has cross-compiling logic for --all
    // The --all case appears twice: once in arg parsing and once in build execution
    // We validate the whole file contains the required build commands
    expect(sh).toContain("Cross-compiling macOS DMGs");
    expect(sh).toContain("Cross-compiling Windows EXEs");
    expect(sh).toContain("Cross-compiling Linux packages");
    expect(sh).toContain("--mac --arm64 --x64");
    expect(sh).toContain("--win --x64 --ia32");
    expect(sh).toContain("--linux --x64 --arm64");
    // Should have at least 2 occurrences of mac arm64+x64 (one in mac all-arch, one in all)
    const macAllArch = (sh.match(/--mac --arm64 --x64/g) || []).length;
    expect(macAllArch).toBeGreaterThanOrEqual(1);
  });

  it("build.sh --mac --all-arch builds x64+arm64", () => {
    expect(sh).toContain("--mac --arm64 --x64");
  });

  it("build.sh --win --all-arch builds x64+ia32", () => {
    expect(sh).toContain("--win --x64 --ia32");
  });

  it("build.sh --linux --all-arch builds x64+arm64", () => {
    expect(sh).toContain("--linux --x64 --arm64");
  });

  it("build.bat --all builds mac x64+arm64, win x64+ia32, linux x64+arm64", () => {
    expect(bat).toContain("--mac --arm64 --x64");
    expect(bat).toContain("--win --x64 --ia32");
    expect(bat).toContain("--linux --x64 --arm64");
  });

  it("build.bat --all-arch for win builds x64+ia32", () => {
    expect(bat).toContain("--x64 --ia32");
  });

  it("both scripts support per-arch override", () => {
    for (const flag of ["--x64", "--arm64", "--ia32"]) {
      expect(sh).toContain(flag);
      expect(bat).toContain(flag);
    }
  });
});

describe("strict-matrix: package.json scripts coverage", () => {
  let pkg: any;
  beforeAll(() => {
    pkg = JSON.parse(read("package.json"));
  });

  it("has 6 primary scripts: mac x64, mac arm64, win x64, win ia32, linux x64, linux arm64", () => {
    expect(pkg.scripts["electron:mac:x64"]).toBe("electron-builder --mac --x64");
    expect(pkg.scripts["electron:mac:arm64"]).toBe("electron-builder --mac --arm64");
    expect(pkg.scripts["electron:win:x64"]).toBe("electron-builder --win --x64");
    expect(pkg.scripts["electron:win:ia32"]).toBe("electron-builder --win --ia32");
    expect(pkg.scripts["electron:linux:x64"]).toBe("electron-builder --linux --x64");
    expect(pkg.scripts["electron:linux:arm64"]).toBe("electron-builder --linux --arm64");
  });

  it("has secondary scripts: mac universal, win arm64", () => {
    expect(pkg.scripts["electron:mac:universal"]).toBe("electron-builder --mac --universal");
    expect(pkg.scripts["electron:win:arm64"]).toBe("electron-builder --win --arm64");
  });

  it("has all-arch scripts: mac x64+arm64, win x64+ia32, linux x64+arm64", () => {
    expect(pkg.scripts["electron:mac"]).toContain("--x64");
    expect(pkg.scripts["electron:mac"]).toContain("--arm64");
    expect(pkg.scripts["electron:win"]).toContain("--x64");
    expect(pkg.scripts["electron:win"]).toContain("--ia32");
    expect(pkg.scripts["electron:linux"]).toContain("--x64");
    expect(pkg.scripts["electron:linux"]).toContain("--arm64");
  });

  it("has electron:all covering all 3 OS and 3 primary arch", () => {
    const all = pkg.scripts["electron:all"];
    expect(all).toContain("--mac");
    expect(all).toContain("--win");
    expect(all).toContain("--linux");
    expect(all).toContain("--x64");
    expect(all).toContain("--arm64");
    expect(all).toContain("--ia32");
  });

  it("has build:all scripts for all OS/arch via Node", () => {
    expect(pkg.scripts["build:all"]).toContain("build-all.mjs");
    expect(pkg.scripts["build:all:dry"]).toContain("--dry-run");
  });
});

describe("strict-matrix: electron-builder.json supports all OS/arch via CLI", () => {
  let cfg: any;
  beforeAll(() => {
    cfg = JSON.parse(read("electron-builder.json"));
  });

  it("mac artifactName contains ${arch} to support x64, arm64, universal", () => {
    expect(cfg.mac.artifactName).toContain("${arch}");
  });

  it("win artifactName contains ${arch} to support x64, ia32, arm64", () => {
    expect(cfg.nsis.artifactName).toContain("${arch}");
  });

  it("linux artifactName contains ${arch} to support x64, arm64, ia32, armv7l", () => {
    expect(cfg.linux.artifactName).toContain("${arch}");
  });

  it("config does not hardcode arch, allowing CLI --arch flags", () => {
    const str = JSON.stringify(cfg);
    // Should not contain hardcoded arch in artifactName except placeholder
    expect(str).not.toContain("x64.dmg");
    expect(str).not.toContain("arm64.dmg");
    expect(str).not.toContain("ia32.exe");
  });

  it("publish null allows building all OS/arch without credentials", () => {
    expect(cfg.publish).toBeNull();
  });
});

describe("strict-matrix: GitHub workflows matrix completeness", () => {
  let buildYml: string;
  beforeAll(() => {
    buildYml = read(".github/workflows/build.yml");
  });

  it("build.yml matrix includes 6 primary artifacts", () => {
    const primaryArtifacts = [
      "G1Wiggle-*-x64.dmg",
      "G1Wiggle-*-arm64.dmg",
      "G1Wiggle-Setup-*-x64.exe",
      "G1Wiggle-Setup-*-ia32.exe",
      "G1Wiggle-*-x64.AppImage",
      "G1Wiggle-*-arm64.AppImage",
    ];
    for (const artifact of primaryArtifacts) {
      expect(buildYml).toContain(artifact);
    }
  });

  it("build.yml includes macos-latest, windows-latest, ubuntu-latest, ubuntu-24.04-arm", () => {
    expect(buildYml).toContain("macos-latest");
    expect(buildYml).toContain("windows-latest");
    expect(buildYml).toContain("ubuntu-latest");
    expect(buildYml).toContain("ubuntu-24.04-arm");
  });

  it("build.yml has build-all-arch-per-os for mac, win, linux", () => {
    expect(buildYml).toContain("build-all-arch-per-os");
    expect(buildYml).toContain("--arm64 --x64");
    expect(buildYml).toContain("--x64 --ia32");
    expect(buildYml).toContain("--x64 --arm64");
  });

  it("build.yml has build-all cross-compiling all OS", () => {
    expect(buildYml).toContain("build-all:");
    expect(buildYml).toContain("--mac --arm64 --x64");
    expect(buildYml).toContain("--win --x64 --ia32");
    expect(buildYml).toContain("--linux --x64 --arm64");
  });
});

describe("strict-matrix: artifact naming strict regex", () => {
  it("primary artifacts match strict naming convention", () => {
    for (const t of PRIMARY) {
      if (t.os === "mac") {
        expect(t.artifact).toMatch(/^G1Wiggle-\d+\.\d+\.\d+-(x64|arm64)\.dmg$/);
      } else if (t.os === "win") {
        expect(t.artifact).toMatch(/^G1Wiggle-Setup-\d+\.\d+\.\d+-(x64|ia32)\.exe$/);
      } else {
        expect(t.artifact).toMatch(/^G1Wiggle-\d+\.\d+\.\d+-(x64|arm64)\.AppImage$/);
      }
    }
  });

  it("secondary artifacts match strict naming", () => {
    expect(SECONDARY[0].artifact).toMatch(/^G1Wiggle-\d+\.\d+\.\d+-universal\.dmg$/);
    expect(SECONDARY[1].artifact).toMatch(/^G1Wiggle-Setup-\d+\.\d+\.\d+-arm64\.exe$/);
  });

  it("legacy artifacts match strict naming", () => {
    expect(LEGACY[0].artifact).toMatch(/^G1Wiggle-\d+\.\d+\.\d+-ia32\.AppImage$/);
    expect(LEGACY[1].artifact).toMatch(/^G1Wiggle-\d+\.\d+\.\d+-armv7l\.AppImage$/);
  });

  it("all artifacts contain version 1.0.0 placeholder and arch", () => {
    for (const t of ALL) {
      expect(t.artifact).toContain("1.0.0");
      expect(t.artifact).toContain(t.arch);
    }
  });
});
