/**
 * G1Wiggle — Strict Supported Matrix Validation
 *
 * Exactly seven supported production targets:
 * macOS x64/arm64/universal, Windows x64/ia32, Linux x64/arm64.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");

type OSKind = "mac" | "win" | "linux";
type ArchKind = "x64" | "arm64" | "ia32" | "universal";

interface StrictTarget {
  os: OSKind;
  arch: ArchKind;
  ext: string;
  runner: string;
  artifact: string;
  buildCmd: string;
}

const TARGETS: StrictTarget[] = [
  { os: "mac", arch: "x64", ext: "dmg", runner: "macos-15-intel", artifact: "G1Wiggle-1.0.0-x64.dmg", buildCmd: "npx electron-builder --mac --x64 -p never --config electron-builder.json" },
  { os: "mac", arch: "arm64", ext: "dmg", runner: "macos-latest", artifact: "G1Wiggle-1.0.0-arm64.dmg", buildCmd: "npx electron-builder --mac --arm64 -p never --config electron-builder.json" },
  { os: "mac", arch: "universal", ext: "dmg", runner: "macos-latest", artifact: "G1Wiggle-1.0.0-universal.dmg", buildCmd: "npx electron-builder --mac --universal -p never --config electron-builder.json" },
  { os: "win", arch: "x64", ext: "exe", runner: "windows-latest", artifact: "G1Wiggle-Setup-1.0.0-x64.exe", buildCmd: "npx electron-builder --win --x64 -p never --config electron-builder.json" },
  { os: "win", arch: "ia32", ext: "exe", runner: "windows-latest", artifact: "G1Wiggle-Setup-1.0.0-ia32.exe", buildCmd: "npx electron-builder --win --ia32 -p never --config electron-builder.json" },
  { os: "linux", arch: "x64", ext: "AppImage", runner: "ubuntu-latest", artifact: "G1Wiggle-1.0.0-x86_64.AppImage", buildCmd: "npx electron-builder --linux --x64 -p never --config electron-builder.json" },
  { os: "linux", arch: "arm64", ext: "AppImage", runner: "ubuntu-24.04-arm", artifact: "G1Wiggle-1.0.0-arm64.AppImage", buildCmd: "npx electron-builder --linux --arm64 -p never --config electron-builder.json" },
];

function read(p: string): string {
  return fs.readFileSync(path.join(rootDir, p), "utf8");
}

describe("strict-matrix: exact seven targets", () => {
  it("has exactly seven targets", () => {
    expect(TARGETS.length).toBe(7);
  });

  it("matches the supported OS/architecture set exactly", () => {
    expect(TARGETS.map(t => `${t.os}-${t.arch}`).sort()).toEqual([
      "linux-arm64",
      "linux-x64",
      "mac-arm64",
      "mac-universal",
      "mac-x64",
      "win-ia32",
      "win-x64",
    ]);
  });

  it("has no Windows ARM64 or Linux ARMv7/ia32 target", () => {
    expect(TARGETS.some(t => t.os === "win" && t.arch === "arm64")).toBe(false);
    expect(TARGETS.some(t => t.os === "linux" && t.arch === "armv7l")).toBe(false);
    expect(TARGETS.some(t => t.os === "linux" && t.arch === "ia32")).toBe(false);
  });

  it("has no duplicate OS/architecture combinations or artifact names", () => {
    expect(new Set(TARGETS.map(t => `${t.os}-${t.arch}`).sort()).size).toBe(7);
    expect(new Set(TARGETS.map(t => t.artifact)).size).toBe(7);
  });

  it("uses correct runners and artifact extensions", () => {
    for (const t of TARGETS) {
      expect(t.runner).toMatch(/^(macos|windows|ubuntu)/);
      expect(t.ext).toBe(t.os === "mac" ? "dmg" : t.os === "win" ? "exe" : "AppImage");
    }
  });

  it("uses architecture-aware artifact names", () => {
    for (const t of TARGETS) {
      expect(t.artifact).toContain(t.arch);
      expect(t.artifact).toContain("1.0.0");
    }
  });

  it("uses strict per-target electron-builder commands", () => {
    for (const t of TARGETS) {
      expect(t.buildCmd).toContain("electron-builder");
      expect(t.buildCmd).toContain(`--${t.os}`);
      expect(t.buildCmd).toContain(`--${t.arch}`);
      expect(t.buildCmd).toContain("-p never");
      expect(t.buildCmd).toContain("--config electron-builder.json");
    }
  });
});

describe("strict-matrix: build scripts", () => {
  let sh: string;
  let bat: string;
  beforeAll(() => {
    sh = read("build.sh");
    bat = read("build.bat");
  });

  it("build.sh covers supported all-arch commands", () => {
    expect(sh).toContain("--mac --arm64 --x64");
    expect(sh).toContain("--win --x64 --ia32");
    expect(sh).toContain("--linux --x64 --arm64");
  });

  it("build.bat covers supported all-arch commands", () => {
    expect(bat).toContain("--mac --arm64 --x64");
    expect(bat).toContain("--win --x64 --ia32");
    expect(bat).toContain("--linux --x64 --arm64");
  });
});

describe("strict-matrix: package scripts", () => {
  const pkg = JSON.parse(read("package.json"));

  it("has all supported per-platform scripts", () => {
    expect(pkg.scripts["electron:mac:x64"]).toBe("electron-builder --mac --x64");
    expect(pkg.scripts["electron:mac:arm64"]).toBe("electron-builder --mac --arm64");
    expect(pkg.scripts["electron:mac:universal"]).toBe("electron-builder --mac --universal");
    expect(pkg.scripts["electron:win:x64"]).toBe("electron-builder --win --x64");
    expect(pkg.scripts["electron:win:ia32"]).toBe("electron-builder --win --ia32");
    expect(pkg.scripts["electron:linux:x64"]).toBe("electron-builder --linux --x64");
    expect(pkg.scripts["electron:linux:arm64"]).toBe("electron-builder --linux --arm64");
  });

  it("does not expose unsupported Windows ARM64 or Linux ARMv7 scripts", () => {
    expect(pkg.scripts["electron:win:arm64"]).toBeUndefined();
    expect(pkg.scripts["electron:linux:armv7l"]).toBeUndefined();
  });

  it("electron:all does not build unsupported Windows ARM64/Linux ARMv7", () => {
    const all = pkg.scripts["electron:all"];
    expect(all).toContain("--win --x64 --ia32");
    expect(all).toContain("--linux --x64 --arm64");
    expect(all).not.toContain("--win --arm64");
    expect(all).not.toContain("--linux --armv7l");
  });
});

describe("strict-matrix: electron-builder config", () => {
  const cfg = JSON.parse(read("electron-builder.json"));

  it("uses architecture-aware artifact names for every OS", () => {
    expect(cfg.mac.artifactName).toContain("${arch}");
    expect(cfg.nsis.artifactName).toContain("${arch}");
    expect(cfg.linux.artifactName).toContain("${arch}");
  });

  it("defines DMG, NSIS, and AppImage targets", () => {
    expect(cfg.mac.target[0].target).toBe("dmg");
    expect(cfg.win.target[0].target).toBe("nsis");
    expect(cfg.linux.target[0].target).toBe("AppImage");
  });

  it("does not hardcode an architecture into packaging config", () => {
    const str = JSON.stringify(cfg);
    expect(str).not.toContain("x64.dmg");
    expect(str).not.toContain("arm64.dmg");
    expect(str).not.toContain("ia32.exe");
  });
});

describe("strict-matrix: GitHub Actions matrix", () => {
  const buildYml = read(".github/workflows/build.yml");

  it("contains exactly seven matrix entries", () => {
    expect((buildYml.match(/- \{ os:/g) || []).length).toBe(7);
  });

  it("contains all seven artifact patterns", () => {
    for (const t of TARGETS) {
      const pattern = t.os === "win"
        ? `G1Wiggle-Setup-*-${t.arch}.exe`
        : `G1Wiggle-*-${t.arch}.${t.ext}`;
      expect(buildYml).toContain(pattern);
    }
  });

  it("uses independent parallel execution", () => {
    expect(buildYml).toContain("fail-fast: false");
    expect(buildYml).toContain("max-parallel: 7");
    expect(buildYml).not.toContain("needs: test");
  });

  it("does not contain unsupported matrix architectures", () => {
    expect(buildYml).not.toContain("windows-11-arm");
    expect(buildYml).not.toContain("--win --arm64");
    expect(buildYml).not.toContain("armv7l");
  });
});
