# G1Wiggle

An elegant, modern cursor automation and workstation keep-alive platform designed to prevent sleep timeouts and maintain presence with natural, configurable movement patterns.

## Features

- ⚡ **Dynamic Cursor Engine**: Harmonic movement patterns including Jitter, Sine Wave, Lissajous Figure 8, and Organic Brownian Random Walk.
- 🕒 **Intelligent Scheduler**: Time-based active windows that automatically engage during work hours and disengage when off the clock.
- 🛡️ **Screen Wake Lock API**: Prevents OS display standby and system lock.
- 🎯 **Profile Customization**: Fine-tune amplitude, speed, interval period, and movement radius.
- ⌨️ **Global Shortcut Triggering**: Quick toggle and pause hotkeys.
- 🎨 **Sleek Dark Interface**: Responsive glassmorphic UI built with React & Tailwind tokens.

## Project Structure

```
project-root/
├── public/
│   └── icon.svg
│
├── src/
│   ├── components/
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
│   │   ├── time.ts
│   │   └── types.ts
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

### Build

```bash
npm run build
```

## License

MIT © [urstrulyg1](https://github.com/urstrulyg1)