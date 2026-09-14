/**
 * G1Wiggle — Desktop Main Process (Electron)
 *
 * Provides:
 *  - Native hardware keep-awake (powerSaveBlocker prevent-display-sleep)
 *  - Desktop window framing, traffic lights styling on macOS
 *  - System Tray integration with instant toggle and status
 *  - Secure webPreferences (contextIsolation, sandbox, disabled nodeIntegration)
 *  - Safe link handling (all external web targets routed to default system browser)
 */

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  powerSaveBlocker,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");

const isMac = process.platform === "darwin";
const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");

let mainWindow = null;
let tray = null;
let powerSaveBlockerId = null;
let isQuitting = false;

function setPowerSaveBlocker(enable) {
  if (enable) {
    if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlockerId = powerSaveBlocker.start("prevent-display-sleep");
    }
  } else {
    if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
    }
  }
}

function getIconPath() {
  if (isMac) {
    const icns = path.join(__dirname, "../build/icon.icns");
    if (fs.existsSync(icns)) return icns;
  }
  const ico = path.join(__dirname, "../build/icon.ico");
  if (process.platform === "win32" && fs.existsSync(ico)) return ico;
  const png = path.join(__dirname, "../build/icon.png");
  if (fs.existsSync(png)) return png;
  return undefined;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: "#0b0f0b",
    title: "G1Wiggle",
    icon: getIconPath(),
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Default keep-awake started on launch
    setPowerSaveBlocker(true);
  });

  // Intercept new window creations to open in external default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Intercept navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith("http://localhost")) {
      event.preventDefault();
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on("close", (event) => {
    if (isMac && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Load production file or dev server
  const indexPath = path.join(__dirname, "../dist/index.html");
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    // If dist hasn't been built yet in dev
    mainWindow.loadURL("http://localhost:5173");
  }
}

function createTray() {
  try {
    const pngPath = path.join(__dirname, "../build/icon.png");
    if (!fs.existsSync(pngPath)) return;

    const nImg = nativeImage.createFromPath(pngPath).resize({ width: 18, height: 18 });
    tray = new Tray(nImg);
    tray.setToolTip("G1Wiggle — Workstation Keep-Alive");

    const updateContextMenu = () => {
      const isAwake = powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId);
      const menu = Menu.buildFromTemplate([
        { label: "G1Wiggle", enabled: false },
        {
          label: isAwake ? "● Keep-Awake: ACTIVE" : "○ Keep-Awake: PAUSED",
          enabled: false,
        },
        { type: "separator" },
        {
          label: isAwake ? "Pause Keep-Awake" : "Resume Keep-Awake",
          click: () => {
            setPowerSaveBlocker(!isAwake);
            updateContextMenu();
          },
        },
        {
          label: "Show Main Window",
          click: () => {
            if (!mainWindow) {
              createMainWindow();
            } else {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { type: "separator" },
        {
          label: "Quit G1Wiggle",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);
      tray.setContextMenu(menu);
    };

    updateContextMenu();

    tray.on("click", () => {
      if (!mainWindow) {
        createMainWindow();
      } else if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.error("Tray initialization error:", err);
  }
}

function createMenu() {
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: "About G1Wiggle" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide", label: "Hide G1Wiggle" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              {
                label: "Quit G1Wiggle",
                accelerator: "Command+Q",
                click: () => {
                  isQuitting = true;
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "G1Wiggle GitHub Repository",
          click: () => shell.openExternal("https://github.com/urstrulyg1/G1Wiggle"),
        },
        {
          label: "Report an Issue",
          click: () => shell.openExternal("https://github.com/urstrulyg1/G1Wiggle/issues"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.on("wiggle:power-save", (event, { active }) => {
  setPowerSaveBlocker(Boolean(active));
});

ipcMain.on("wiggle:window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("wiggle:window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on("wiggle:window-close", () => {
  if (mainWindow) mainWindow.close();
});

// App lifecycle
const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();
    createMenu();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  setPowerSaveBlocker(false);
});

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});
