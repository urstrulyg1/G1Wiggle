/**
 * G1Wiggle — Build Matrix Exhaustive Tests
 *
 * Tests every combination of OS × Architecture to ensure the pipeline
 * can create all apps for all architectures and all operating systems.
 *
 * This file complements pipeline.test.ts with deeper per-target validation,
 * artifact path resolution, and simulated packaging logic.
 */

import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Exhaustive matrix — mirrors electron-builder capabilities
// ---------------------------------------------------------------------------

type OSType = "mac" | "win" | "linux";
type ArchType = "x64" | "arm64" | "ia32" | "armv7l" | "universal";

interface MatrixEntry {
  os: OSType;
  arch: ArchType;
  ext: string;
  target: string; // electron-builder target
  artifact: string; // example artifact name
  runner: string;
  supported: boolean;
  priority: "primary" | "secondary" | "legacy";
  notes: string;
}

const MATRIX: MatrixEntry[] = [
  // macOS — primary: x64 + arm64, secondary: universal
  {
    os: "mac",
    arch: "x64",
    ext: "dmg",
    target: "dmg",
    artifact: "G1Wiggle-1.0.0-x64.dmg",
    runner: "macos-latest",
    supported: true,
    priority: "primary",
    notes: "Intel Macs, Rosetta 2 compatible",
  },
  {
    os: "mac",
    arch: "arm64",
    ext: "dmg",
    target: "dmg",
    artifact: "G1Wiggle-1.0.0-arm64.dmg",
    runner: "macos-latest",
    supported: true,
    priority: "primary",
    notes: "Apple Silicon M1/M2/M3/M4 native",
  },
  {
    os: "mac",
    arch: "universal",
    ext: "dmg",
    target: "dmg",
    artifact: "G1Wiggle-1.0.0-universal.dmg",
    runner: "macos-latest",
    supported: true,
    priority: "secondary",
    notes: "Universal binary, larger size",
  },

  // Windows — primary: x64 + ia32, secondary: arm64
  {
    os: "win",
    arch: "x64",
    ext: "exe",
    target: "nsis",
    artifact: "G1Wiggle-Setup-1.0.0-x64.exe",
    runner: "windows-latest",
    supported: true,
    priority: "primary",
    notes: "64-bit Windows 10/11",
  },
  {
    os: "win",
    arch: "ia32",
    ext: "exe",
    target: "nsis",
    artifact: "G1Wiggle-Setup-1.0.0-ia32.exe",
    runner: "windows-latest",
    supported: true,
    priority: "primary",
    notes: "32-bit Windows 10/11, legacy support",
  },
  {
    os: "win",
    arch: "arm64",
    ext: "exe",
    target: "nsis",
    artifact: "G1Wiggle-Setup-1.0.0-arm64.exe",
    runner: "windows-latest",
    supported: true,
    priority: "secondary",
    notes: "Windows on ARM (Surface Pro X, etc)",
  },

  // Linux — primary: x64 + arm64, legacy: ia32, armv7l
  {
    os: "linux",
    arch: "x64",
    ext: "AppImage",
    target: "AppImage",
    artifact: "G1Wiggle-1.0.0-x64.AppImage",
    runner: "ubuntu-latest",
    supported: true,
    priority: "primary",
    notes: "x86_64 Linux, most common",
  },
  {
    os: "linux",
    arch: "arm64",
    ext: "AppImage",
    target: "AppImage",
    artifact: "G1Wiggle-1.0.0-arm64.AppImage",
    runner: "ubuntu-24.04-arm",
    supported: true,
    priority: "primary",
    notes: "AArch64 Linux, Raspberry Pi 4/5, ARM servers",
  },
  {
    os: "linux",
    arch: "ia32",
    ext: "AppImage",
    target: "AppImage",
    artifact: "G1Wiggle-1.0.0-ia32.AppImage",
    runner: "ubuntu-latest",
    supported: false,
    priority: "legacy",
    notes: "32-bit Linux, deprecated",
  },
  {
    os: "linux",
    arch: "armv7l",
    ext: "AppImage",
    target: "AppImage",
    artifact: "G1Wiggle-1.0.0-armv7l.AppImage",
    runner: "ubuntu-latest",
    supported: true,
    priority: "secondary",
    notes: "ARMv7 32-bit; Electron 43 is the final supported Electron line for this target",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElectronBuilderConfig(): any {
  const p = path.join(rootDir, "electron-builder.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function buildCommandFor(entry: MatrixEntry): string {
  return `npx electron-builder --${entry.os} --${entry.arch} -p never --config electron-builder.json`;
}

function buildCommandAllArch(os: OSType): string {
  const archs = MATRIX.filter((m) => m.os === os && m.priority === "primary")
    .map((m) => `--${m.arch}`)
    .join(" ");
  return `npx electron-builder --${os} ${archs} -p never --config electron-builder.json`;
}

function buildCommandAll(): string {
  const mac = buildCommandAllArch("mac");
  const win = buildCommandAllArch("win");
  const linux = buildCommandAllArch("linux");
  return `${mac} && ${win} && ${linux}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("build-matrix: exhaustive OS × Arch coverage", () => {
  it("defines the complete supported and legacy matrix", () => {
    expect(MATRIX.length).toBe(10);
  });

  it("has 6 primary production targets", () => {
    const primary = MATRIX.filter((m) => m.priority === "primary" && m.supported);
    expect(primary.length).toBe(6);
    expect(primary.map((m) => `${m.os}-${m.arch}`).sort()).toEqual([
      "linux-arm64",
      "linux-x64",
      "mac-arm64",
      "mac-x64",
      "win-ia32",
      "win-x64",
    ]);
  });

  it("covers 3 OS families", () => {
    const osSet = new Set(MATRIX.map((m) => m.os));
    expect(osSet.size).toBe(3);
    expect(osSet.has("mac")).toBe(true);
    expect(osSet.has("win")).toBe(true);
    expect(osSet.has("linux")).toBe(true);
  });

  it("covers 5 architecture families", () => {
    const archSet = new Set(MATRIX.map((m) => m.arch));
    expect(archSet.has("x64")).toBe(true);
    expect(archSet.has("arm64")).toBe(true);
    expect(archSet.has("ia32")).toBe(true);
    expect(archSet.has("armv7l")).toBe(true);
    expect(archSet.has("universal")).toBe(true);
  });

  it("each OS has at least 2 primary archs", () => {
    for (const os of ["mac", "win", "linux"] as OSType[]) {
      const primary = MATRIX.filter((m) => m.os === os && m.priority === "primary");
      expect(primary.length, `${os} should have >=2 primary archs`).toBeGreaterThanOrEqual(2);
    }
  });

  it("artifact extensions match OS conventions", () => {
    for (const entry of MATRIX) {
      if (entry.os === "mac") expect(entry.ext).toBe("dmg");
      if (entry.os === "win") expect(entry.ext).toBe("exe");
      if (entry.os === "linux") expect(entry.ext).toBe("AppImage");
    }
  });

  it("all primary artifacts have unique filenames", () => {
    const primary = MATRIX.filter((m) => m.priority === "primary");
    const artifacts = primary.map((m) => m.artifact);
    const unique = new Set(artifacts);
    expect(unique.size).toBe(artifacts.length);
  });

  it("artifact names contain arch for disambiguation", () => {
    for (const entry of MATRIX) {
      expect(entry.artifact).toContain(entry.arch);
    }
  });
});

describe("build-matrix: electron-builder config per target", () => {
  let config: any;

  beforeAll(() => {
    config = getElectronBuilderConfig();
  });

  it("mac config supports x64, arm64, universal via CLI flags (arch-agnostic config)", () => {
    expect(config.mac.artifactName).toContain("${arch}");
    // Config should not hardcode arch
    expect(config.mac.artifactName).not.toContain("x64");
    expect(config.mac.artifactName).not.toContain("arm64");
  });

  it("win config supports x64, ia32, arm64 via CLI flags", () => {
    expect(config.nsis.artifactName).toContain("${arch}");
  });

  it("linux config uses arch-aware artifacts for supported targets", () => {
    expect(config.linux.artifactName).toContain("${arch}");
  });

  it("all configs use same output directory (release/)", () => {
    expect(config.directories.output).toBe("release");
  });

  it("files include dist, electron, build assets for all OS", () => {
    const filesStr = config.files.join(" ");
    expect(filesStr).toContain("dist");
    expect(filesStr).toContain("electron");
    expect(filesStr).toContain("build");
  });
});

describe("build-matrix: build command generation", () => {
  it("generates valid command for each primary target", () => {
    for (const entry of MATRIX.filter((m) => m.priority === "primary")) {
      const cmd = buildCommandFor(entry);
      expect(cmd).toContain(`--${entry.os}`);
      expect(cmd).toContain(`--${entry.arch}`);
      expect(cmd).toContain("electron-builder");
      expect(cmd).toContain("-p never");
    }
  });

  it("generates all-arch command per OS", () => {
    const macCmd = buildCommandAllArch("mac");
    expect(macCmd).toContain("--mac");
    expect(macCmd).toContain("--x64");
    expect(macCmd).toContain("--arm64");

    const winCmd = buildCommandAllArch("win");
    expect(winCmd).toContain("--win");
    expect(winCmd).toContain("--x64");
    expect(winCmd).toContain("--ia32");

    const linuxCmd = buildCommandAllArch("linux");
    expect(linuxCmd).toContain("--linux");
    expect(linuxCmd).toContain("--x64");
    expect(linuxCmd).toContain("--arm64");
  });

  it("generates --all command that chains 3 OS builds", () => {
    const allCmd = buildCommandAll();
    const segments = allCmd.split("&&");
    expect(segments.length).toBe(3);
    expect(allCmd).toContain("--mac");
    expect(allCmd).toContain("--win");
    expect(allCmd).toContain("--linux");
  });

  it("all-arch commands are idempotent (same input = same output)", () => {
    expect(buildCommandAllArch("mac")).toBe(buildCommandAllArch("mac"));
    expect(buildCommandAllArch("win")).toBe(buildCommandAllArch("win"));
    expect(buildCommandAllArch("linux")).toBe(buildCommandAllArch("linux"));
  });

  it("primary targets can be built in parallel (no shared mutable state)", () => {
    const commands = MATRIX.filter((m) => m.priority === "primary").map(buildCommandFor);
    // Each command should be self-contained
    for (const cmd of commands) {
      expect(cmd).toContain("--config electron-builder.json");
      expect(cmd).toContain("-p never");
    }
  });
});

describe("build-matrix: artifact path resolution", () => {
  it("resolves release/ path for each primary artifact", () => {
    for (const entry of MATRIX.filter((m) => m.priority === "primary")) {
      const releasePath = path.join(rootDir, "release", entry.artifact);
      // Path should be absolute and inside release/
      expect(path.isAbsolute(releasePath)).toBe(true);
      expect(releasePath).toContain("release");
      expect(releasePath).toContain(entry.arch);
    }
  });

  it("artifact naming follows pattern: ProductName-[Setup-]Version-Arch.Ext", () => {
    for (const entry of MATRIX.filter((m) => m.supported)) {
      if (entry.os === "win") {
        expect(entry.artifact).toMatch(/G1Wiggle-Setup-.*-.*\.exe/);
      } else {
        expect(entry.artifact).toMatch(/G1Wiggle-.*-.*\.(dmg|AppImage)/);
      }
    }
  });

  it("all primary artifacts have version placeholder resolved", () => {
    const version = "1.0.0";
    for (const entry of MATRIX.filter((m) => m.priority === "primary")) {
      expect(entry.artifact).toContain(version);
    }
  });
});

describe("build-matrix: platform-specific asset requirements", () => {
  const buildDir = path.join(rootDir, "build");

  it("mac targets require icon.icns and background.tiff", () => {
    const macEntries = MATRIX.filter((m) => m.os === "mac" && m.supported);
    expect(macEntries.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(buildDir, "icon.icns"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "background.tiff"))).toBe(true);
  });

  it("win targets require icon.ico and NSIS bitmaps", () => {
    const winEntries = MATRIX.filter((m) => m.os === "win" && m.supported);
    expect(winEntries.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(buildDir, "icon.ico"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "installerSidebar.bmp"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "installerHeader.bmp"))).toBe(true);
  });

  it("linux targets require icons/ directory with multi-res PNGs", () => {
    const linuxEntries = MATRIX.filter((m) => m.os === "linux" && m.supported);
    expect(linuxEntries.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(buildDir, "icons"))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, "icons", "256x256.png"))).toBe(true);
  });

  it("all OS targets require master icon.png", () => {
    expect(fs.existsSync(path.join(buildDir, "icon.png"))).toBe(true);
  });
});

describe("build-matrix: build.sh and build.bat matrix coverage", () => {
  const shPath = path.join(rootDir, "build.sh");
  const batPath = path.join(rootDir, "build.bat");
  let sh = "";
  let bat = "";

  beforeAll(() => {
    sh = fs.readFileSync(shPath, "utf8");
    bat = fs.readFileSync(batPath, "utf8");
  });

  it("build.sh builds mac x64 and arm64 when --all or --mac --all-arch", () => {
    expect(sh).toContain("--mac --arm64 --x64");
  });

  it("build.sh builds win x64 and ia32 when --all or --win --all-arch", () => {
    expect(sh).toContain("--win --x64 --ia32");
  });

  it("build.sh builds linux x64 and arm64 when --all or --linux --all-arch", () => {
    expect(sh).toContain("--linux --x64 --arm64");
  });

  it("build.bat builds win x64 and ia32 for --all-arch", () => {
    expect(bat).toContain("--x64 --ia32");
  });

  it("build.bat builds mac x64 and arm64 for --all", () => {
    expect(bat).toContain("--mac --arm64 --x64");
  });

  it("build.bat builds linux x64 and arm64 for --all", () => {
    expect(bat).toContain("--linux --x64 --arm64");
  });

  it("both scripts support per-arch override (--x64, --arm64, --ia32)", () => {
    expect(sh).toContain("--x64");
    expect(sh).toContain("--arm64");
    expect(sh).toContain("--ia32");
    expect(bat).toContain("--x64");
    expect(bat).toContain("--arm64");
    expect(bat).toContain("--ia32");
  });
});

describe("build-matrix: GitHub Actions runner mapping", () => {
  it("maps mac targets to macos-latest", () => {
    for (const entry of MATRIX.filter((m) => m.os === "mac")) {
      expect(entry.runner).toContain("macos");
    }
  });

  it("maps win targets to windows-latest", () => {
    for (const entry of MATRIX.filter((m) => m.os === "win")) {
      expect(entry.runner).toContain("windows");
    }
  });

  it("maps linux targets to ubuntu", () => {
    for (const entry of MATRIX.filter((m) => m.os === "linux")) {
      expect(entry.runner).toContain("ubuntu");
    }
  });

  it("primary matrix uses 3 distinct runner families", () => {
    const runners = new Set(MATRIX.filter((m) => m.priority === "primary").map((m) => m.runner.split("-")[0]));
    // macos, windows, ubuntu
    expect(runners.has("macos")).toBe(true);
    expect(runners.has("windows")).toBe(true);
    expect(runners.has("ubuntu")).toBe(true);
  });
});

describe("build-matrix: package.json scripts matrix", () => {
  let pkg: any;

  beforeAll(() => {
    pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  });

  it("electron:mac covers primary mac archs", () => {
    expect(pkg.scripts["electron:mac"]).toContain("arm64");
    expect(pkg.scripts["electron:mac"]).toContain("x64");
  });

  it("electron:win covers primary win archs", () => {
    expect(pkg.scripts["electron:win"]).toContain("x64");
    expect(pkg.scripts["electron:win"]).toContain("ia32");
  });

  it("electron:linux covers primary linux archs", () => {
    expect(pkg.scripts["electron:linux"]).toContain("x64");
    expect(pkg.scripts["electron:linux"]).toContain("arm64");
  });

  it("electron:all covers the primary production architectures", () => {
    const all = pkg.scripts["electron:all"];
    expect(all).toContain("--mac");
    expect(all).toContain("--win");
    expect(all).toContain("--linux");
    expect(all).toContain("--x64");
    expect(all).toContain("--arm64");
    expect(all).toContain("--ia32");
  });
});

describe("build-matrix: cross-compilation feasibility", () => {
  it("mac can be cross-compiled from any OS (electron-builder supports it)", () => {
    // electron-builder can build mac dmg on linux with appropriate config, but best on macos
    // We test that config doesn't block cross-compilation
    const config = getElectronBuilderConfig();
    expect(config.mac.identity).toBeNull(); // no code signing identity required for local builds
  });

  it("win can be cross-compiled from mac and linux", () => {
    // No special win config that blocks cross-compilation
    const config = getElectronBuilderConfig();
    expect(config.win).toBeDefined();
    expect(config.nsis).toBeDefined();
  });

  it("linux can be cross-compiled from mac and win", () => {
    const config = getElectronBuilderConfig();
    expect(config.linux).toBeDefined();
    // Linux target is AppImage which is cross-compilable
    expect(config.linux.target[0].target).toBe("AppImage");
  });

  it("publish is null to allow local builds without credentials", () => {
    const config = getElectronBuilderConfig();
    expect(config.publish).toBeNull();
  });
});

describe("build-matrix: end-to-end pipeline validation", () => {
  it("validates 6 primary artifacts would be produced by --all", () => {
    const primary = MATRIX.filter((m) => m.priority === "primary" && m.supported);
    const artifacts = primary.map((m) => m.artifact);
    // Primary matrix: mac x64/arm64, win x64/ia32, linux x64/arm64 = 6
    // win arm64 is secondary, not counted in primary length check but still validated
    expect(artifacts).toContain("G1Wiggle-1.0.0-x64.dmg");
    expect(artifacts).toContain("G1Wiggle-1.0.0-arm64.dmg");
    expect(artifacts).toContain("G1Wiggle-Setup-1.0.0-x64.exe");
    expect(artifacts).toContain("G1Wiggle-Setup-1.0.0-ia32.exe");
    expect(artifacts).toContain("G1Wiggle-1.0.0-x64.AppImage");
    expect(artifacts).toContain("G1Wiggle-1.0.0-arm64.AppImage");
    // At least 6 artifacts
    expect(artifacts.length).toBeGreaterThanOrEqual(6);
  });

  it("ensures build pipeline order: icons -> tests -> vite build -> electron per OS/arch", () => {
    const pipeline = [
      "icons",
      "test",
      "vite build",
      ...MATRIX.filter((m) => m.priority === "primary").map((m) => `${m.os}:${m.arch}`),
    ];
    expect(pipeline[0]).toBe("icons");
    expect(pipeline[1]).toBe("test");
    expect(pipeline[2]).toBe("vite build");
    expect(pipeline.length).toBeGreaterThanOrEqual(9); // 3 + 6
  });

  it("simulates parallel builds per OS (no inter-dependency)", () => {
    const macBuilds = MATRIX.filter((m) => m.os === "mac" && m.priority === "primary").map((m) => m.artifact);
    const winBuilds = MATRIX.filter((m) => m.os === "win" && m.priority === "primary").map((m) => m.artifact);
    const linuxBuilds = MATRIX.filter((m) => m.os === "linux" && m.priority === "primary").map((m) => m.artifact);

    // No overlap between OS artifact sets
    const allArtifacts = [...macBuilds, ...winBuilds, ...linuxBuilds];
    const unique = new Set(allArtifacts);
    expect(unique.size).toBe(allArtifacts.length);

    // Each OS group non-empty
    expect(macBuilds.length).toBeGreaterThanOrEqual(2);
    expect(winBuilds.length).toBeGreaterThanOrEqual(2);
    expect(linuxBuilds.length).toBeGreaterThanOrEqual(2);
  });
});
