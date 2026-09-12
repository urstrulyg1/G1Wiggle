# G1Wiggle

An elegant, modern cursor automation and workstation keep-alive platform designed to prevent sleep timeouts and maintain presence with natural, configurable movement patterns.

## Features

- ⚡ **Dynamic Cursor Engine**: Harmonic movement patterns including Jitter, Sine Wave, Lissajous Figure 8, and Organic Brownian Random Walk.
- 🛡️ **Hardware Screen Wake Lock API**: Hardware-level keep-awake lock that actively prevents OS display sleep, screensaver timeout, and system lock.
- ⏱️ **Background Worker Anti-Throttling**: Inline Web Worker thread heartbeat that prevents browser timer throttling in inactive or minimized background tabs.
- 🔊 **Procedural Audio Feedback**: Zero-dependency procedural Web Audio micro-chimes and woodblock clicks for session starts, pauses, stops, and steps.
- 📊 **Lifetime Keep-Alive Analytics**: Local privacy-first metrics tracking all-time & daily keep-alive duration, movements, and estimated sleep timeouts prevented.
- 🌙 **OLED Ambient Fullscreen Mode**: Ultra-dark, distraction-free digital clock and session keep-alive status monitor (`F` key toggle, `Esc` exit).
- 🔋 **Battery & Power Awareness**: Battery Status API integration warning and adapting intervals when running on low battery (< 20%).
- 🕒 **Intelligent Scheduler**: Time-based active windows that automatically engage during work hours and disengage when off the clock.
- 💾 **Complete Backup & Restore**: One-click JSON backup export and import for all configurations, custom profiles, schedules, and analytics.
- 📱 **Progressive Web App (PWA)**: Desktop-installable standalone experience on macOS, Windows, Linux, and ChromeOS.

## Project Structure

```
project-root/
├── public/
│   ├── icon.svg
│   └── manifest.webmanifest
│
├── src/
│   ├── components/
│   │   ├── AmbientModal.tsx
│   │   ├── controls.tsx
│   │   ├── CursorStage.tsx
│   │   ├── Logo.tsx
│   │   ├── Modal.tsx
│   │   ├── PermissionGate.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ToastStack.tsx
│   │   └── TrayMenu.tsx
│   │
│   ├── lib/
│   │   ├── engine.ts
│   │   ├── persistence.ts
│   │   ├── scheduler.ts
│   │   ├── shortcuts.ts
│   │   ├── sound.ts
│   │   ├── time.ts
│   │   ├── types.ts
│   │   └── workerTimer.ts
│   │
│   ├── pages/
│   │   ├── About.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ProfileEditor.tsx
│   │   ├── Profiles.tsx
│   │   ├── SchedulerPage.tsx
│   │   ├── Settings.tsx
│   │   └── ShortcutsPage.tsx
│   │
│   ├── platform/
│   │   ├── detect.ts
│   │   ├── types.ts
│   │   └── web.ts
│   │
│   ├── store/
│   │   └── useStore.ts
│   │
│   ├── utils/
│   │   └── cn.ts
│   │
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
├── tests/
│   ├── engine.test.ts
│   ├── platform.test.ts
│   ├── scheduler.test.ts
│   └── store.test.ts
│
├── index.html
├── LICENSE
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Testing

```bash
npm run test
```

### Web Build

```bash
npm run build
```

### Desktop Packaging (Zero-Config)

The automated `build.sh` script automatically detects your current operating system and packages native production installers into `release/` with **zero flags required**:

```bash
# Automatically detects OS (macOS -> .dmg, Windows -> .exe, Linux -> AppImage)
./build.sh

# Or via npm script:
npm run build:desktop
```

#### Optional Manual Overrides

```bash
# Cross-compile all targets
./build.sh --all

# Force macOS Disk Images (Apple Silicon arm64 & Intel x64)
./build.sh --mac

# Force Windows Installers & Portable Executables (x64 & x86/ia32)
./build.sh --win

# Clean build caches before packaging
./build.sh --clean
```

## License

MIT © [urstrulyg1](https://github.com/urstrulyg1)