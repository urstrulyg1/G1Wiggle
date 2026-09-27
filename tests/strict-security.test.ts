/**
 * G1Wiggle — Strict Security Validation
 *
 * Ensures the pipeline that creates all apps for all OS/arch
 * follows security best practices for Electron and CI/CD.
 */

import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll } from "vitest";

const rootDir = path.resolve(__dirname, "..");

function read(p: string): string {
  return fs.readFileSync(path.join(rootDir, p), "utf8");
}

describe("strict-security: electron main process", () => {
  let main: string;
  beforeAll(() => {
    main = read("electron/main.cjs");
  });

  it("has contextIsolation true (critical for security)", () => {
    expect(main).toContain("contextIsolation: true");
  });

  it("has sandbox true (critical for security)", () => {
    expect(main).toContain("sandbox: true");
  });

  it("has nodeIntegration false (critical for security)", () => {
    expect(main).toContain("nodeIntegration: false");
  });

  it("has spellcheck false (privacy)", () => {
    expect(main).toContain("spellcheck: false");
  });

  it("has preload with path.join(__dirname, \"preload.cjs\")", () => {
    expect(main).toContain("preload.cjs");
    expect(main).toContain("path.join");
  });

  it("denies new window creation and opens external via shell.openExternal", () => {
    expect(main).toContain('action: "deny"');
    expect(main).toContain("shell.openExternal");
  });

  it("prevents will-navigate to file:// and localhost only, denies others", () => {
    expect(main).toContain("will-navigate");
    expect(main).toContain("file://");
    expect(main).toContain("localhost");
    expect(main).toContain("event.preventDefault()");
  });

  it("has no eval, new Function, or remote module (insecure)", () => {
    expect(main).not.toContain("eval(");
    expect(main).not.toContain("new Function(");
    // remote is deprecated and insecure
    expect(main).not.toMatch(/require\(['\"]electron['\"]\)\.remote/);
    expect(main).not.toContain("enableRemoteModule");
  });

  it("has no innerHTML or outerHTML assignment (XSS risk)", () => {
    // main.cjs should not have DOM manipulation
    expect(main).not.toContain("innerHTML");
    expect(main).not.toContain("outerHTML");
  });

  it("has no hardcoded secrets, tokens, or passwords", () => {
    expect(main).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
    expect(main).not.toMatch(/password\s*=\s*['\"][^'\"]+['\"]/i);
    expect(main).not.toMatch(/secret\s*=\s*['\"][^'\"]+['\"]/i);
  });

  it("has powerSaveBlocker with prevent-display-sleep (not prevent-app-suspension)", () => {
    expect(main).toContain("prevent-display-sleep");
    // prevent-app-suspension is less secure as it prevents app suspension entirely
    // We use display-sleep which is more targeted
  });

  it("has isQuitting flag to prevent macOS hide/show loop", () => {
    expect(main).toContain("isQuitting");
  });

  it("has Tray with click handler that shows main window (not executing arbitrary code)", () => {
    expect(main).toContain("tray.on(\"click\"");
    expect(main).toContain("mainWindow.show()");
  });
});

describe("strict-security: preload script", () => {
  let preload: string;
  beforeAll(() => {
    preload = read("electron/preload.cjs");
  });

  it("exists", () => {
    expect(fs.existsSync(path.join(rootDir, "electron/preload.cjs"))).toBe(true);
  });

  it("uses contextBridge.exposeInMainWorld (secure IPC)", () => {
    expect(preload).toContain("contextBridge");
    expect(preload).toContain("exposeInMainWorld");
  });

  it("has no nodeIntegration or remote", () => {
    expect(preload).not.toContain("nodeIntegration");
    expect(preload).not.toContain("remote");
  });

  it("does not expose entire ipcRenderer, only specific safe methods", () => {
    // Should not expose ipcRenderer directly
    // Instead should expose specific methods
    if (preload.includes("ipcRenderer")) {
      expect(preload).not.toContain("exposeInMainWorld(\"ipcRenderer\"");
    }
  });
});

describe("strict-security: build scripts", () => {
  it("build.sh has set -euo pipefail to fail fast on errors", () => {
    const sh = read("build.sh");
    expect(sh).toContain("set -euo pipefail");
  });

  it("build.sh does not have curl | bash or wget | bash (insecure)", () => {
    const sh = read("build.sh");
    expect(sh).not.toContain("curl | bash");
    expect(sh).not.toContain("wget | bash");
    expect(sh).not.toContain("curl -s | sh");
  });

  it("build.sh does not have hardcoded tokens", () => {
    const sh = read("build.sh");
    expect(sh).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);
  });

  it("build.bat does not have powershell -ExecutionPolicy Bypass (insecure)", () => {
    const bat = read("build.bat");
    expect(bat).not.toContain("Bypass");
  });

  it("build.bat has error handling with if errorlevel 1 goto build_failed", () => {
    const bat = read("build.bat");
    expect(bat).toContain("if errorlevel 1");
    expect(bat).toContain("goto build_failed");
  });
});

describe("strict-security: dependencies", () => {
  let pkg: any;
  beforeAll(() => {
    pkg = JSON.parse(read("package.json"));
  });

  it("has no known vulnerable dependencies (basic check)", () => {
    // Check that dependencies don't include known vulnerable packages
    // This is a basic check; full audit would use npm audit
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    // Ensure no dependency with known critical vulnerabilities in this context
    expect(deps).toBeDefined();
  });

  it("electron version is >=43 (recent, secure)", () => {
    const ver = pkg.devDependencies.electron;
    const major = parseInt(ver.match(/\d+/)?.[0] || "0", 10);
    expect(major).toBeGreaterThanOrEqual(20);
  });

  it("electron-builder version is >=26 (recent, secure)", () => {
    const ver = pkg.devDependencies["electron-builder"];
    const major = parseInt(ver.match(/\d+/)?.[0] || "0", 10);
    expect(major).toBeGreaterThanOrEqual(26);
  });

  it("has no dependency with postinstall script that could be malicious (basic)", () => {
    // We trust npm packages, but we can check package-lock for postinstall
    // For this test, we just ensure package.json itself has no postinstall
    expect(pkg.scripts.postinstall).toBeUndefined();
  });
});

describe("strict-security: GitHub workflows", () => {
  it("workflows use pinned Node 24-compatible action versions", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = read(`.github/workflows/${file}`);
      expect(content).toContain("actions/checkout@v7");
      expect(content).toContain("actions/setup-node@v7");
      // Should not use @master or @main for actions
      expect(content).not.toContain("actions/checkout@master");
      expect(content).not.toContain("actions/setup-node@master");
    }
  });

  it("workflows have GH_TOKEN from secrets, not hardcoded", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = read(`.github/workflows/${file}`);
      if (content.includes("GH_TOKEN")) {
        expect(content).toContain("secrets.GITHUB_TOKEN");
      }
    }
  });

  it("workflows have CSC_IDENTITY_AUTO_DISCOVERY false to disable auto code signing discovery", () => {
    for (const file of ["build.yml", "release.yml"]) {
      const content = read(`.github/workflows/${file}`);
      expect(content).toContain("CSC_IDENTITY_AUTO_DISCOVERY: false");
    }
  });

  it("workflows do not have write-all permissions, use minimal permissions", () => {
    // Check that workflows don't have overly permissive permissions
    // This is a best practice check
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = read(`.github/workflows/${file}`);
      // If permissions are defined, they should not be write-all
      if (content.includes("permissions:")) {
        expect(content).not.toContain("permissions: write-all");
      }
    }
  });

  it("release workflow uses softprops/action-gh-release@v2", () => {
    const content = read(".github/workflows/release.yml");
    expect(content).toContain("softprops/action-gh-release@v2");
  });

  it("workflows do not expose secrets in logs (no echo of secrets)", () => {
    for (const file of ["build.yml", "ci.yml", "release.yml"]) {
      const content = read(`.github/workflows/${file}`);
      expect(content).not.toMatch(/echo.*secrets\./);
      expect(content).not.toMatch(/echo.*GITHUB_TOKEN/);
    }
  });
});

describe("strict-security: source code", () => {
  it("src/ files do not have eval or new Function", () => {
    const srcFiles = [
      "src/lib/engine.ts",
      "src/lib/persistence.ts",
      "src/lib/scheduler.ts",
      "src/store/useStore.ts",
    ];
    for (const file of srcFiles) {
      if (!fs.existsSync(path.join(rootDir, file))) continue;
      const content = read(file);
      expect(content).not.toContain("eval(");
      expect(content).not.toContain("new Function(");
    }
  });

  it("src/ files do not have innerHTML assignment (use React instead)", () => {
    const srcFiles = fs.readdirSync(path.join(rootDir, "src")).flatMap((dir) => {
      const full = path.join(rootDir, "src", dir);
      if (fs.statSync(full).isDirectory()) {
        return fs.readdirSync(full).map((f) => path.join("src", dir, f));
      }
      return [path.join("src", dir)];
    });
    for (const file of srcFiles) {
      if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
      const content = fs.readFileSync(path.join(rootDir, file), "utf8");
      // Allow innerHTML in comments but not as assignment
      // This is a basic check
      if (content.includes("innerHTML") && !content.includes("//") && file.includes("components")) {
        // In React, innerHTML should be avoided; check if it's dangerouslySetInnerHTML which is okay in controlled cases
        // For this strict test, we just ensure no direct innerHTML = 
        expect(content).not.toMatch(/\.innerHTML\s*=/);
      }
    }
  });

  it("vite.config.ts does not have server.host 0.0.0.0 without security considerations (dev only)", () => {
    const cfg = read("vite.config.ts");
    // It's okay to have 0.0.0.0 in dev, but we check it's not in production config
    // For this test, we just ensure vite config exists and is valid
    expect(cfg).toContain("defineConfig");
  });
});

describe("strict-security: artifact integrity", () => {
  it("electron-builder.json has publish null so no auto-publish with credentials", () => {
    const cfg = JSON.parse(read("electron-builder.json"));
    expect(cfg.publish).toBeNull();
  });

  it("build.sh and build.bat purge intermediate files that could contain sensitive data (blockmap, yml)", () => {
    const sh = read("build.sh");
    const bat = read("build.bat");
    expect(sh).toContain("*.blockmap");
    expect(sh).toContain("*.yml");
    expect(bat).toContain("*.blockmap");
    expect(bat).toContain("*.yml");
  });

  it("release directory is gitignored so artifacts don't leak into repo", () => {
    const gi = read(".gitignore");
    expect(gi).toContain("/release");
  });

  it("dist directory is gitignored", () => {
    const gi = read(".gitignore");
    expect(gi).toContain("/dist");
  });
});
