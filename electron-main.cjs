const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let backendProcess;
let mainWindow;
let updateInfo;
let updateDownloaded = false;

function safeFileName(name) {
  return String(name || "document")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function createWindow() {
  const basePath = process.resourcesPath;
  const apiPath = path.join(basePath, "api-server");
  const serverFile = path.join(apiPath, "dist", "index.cjs");
  const starterDbPath = path.join(apiPath, "lib", "db", "local.db");
  const userDataPath = app.getPath("userData");
  const appDataDbPath = path.join(userDataPath, "local.db");

  console.log("AppData DB path:", appDataDbPath);
  console.log("Starter DB path:", starterDbPath);

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  if (!fs.existsSync(appDataDbPath)) {
    if (!fs.existsSync(starterDbPath)) {
      throw new Error(`Starter SQLite database not found: ${starterDbPath}`);
    }

    fs.copyFileSync(starterDbPath, appDataDbPath);
    console.log("Copied starter DB:", appDataDbPath);
  }

  console.log("Starting backend from:", serverFile);
  console.log("Using SQLite DB:", appDataDbPath);

  backendProcess = spawn(
    process.execPath,
    ["dist/index.cjs"],
    {
      cwd: apiPath,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
        SQLITE_DB_PATH: appDataDbPath,
      },
      detached: false,
    }
  );
  backendProcess.stdout.on("data", (data) => {
    console.log("API:", data.toString());
  });

  backendProcess.stderr.on("data", (data) => {
    console.error("API ERR:", data.toString());
  });

  backendProcess.on("error", (err) => {
    console.error("Backend process error:", err);
  });

  backendProcess.on("exit", (code, signal) => {
    console.error("Backend process exited:", { code, signal });
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(process.resourcesPath, "preload.js"),
    },
  });

  mainWindow.webContents.on("context-menu", (event, params) => {
    const template = [];

    if (params.isEditable) {
      template.push(
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" }
      );
    } else {
      template.push(
        { role: "copy", label: "Copy", enabled: !!params.selectionText },
        { role: "selectAll", label: "Select All" }
      );
    }

    Menu.buildFromTemplate(template).popup({
      window: mainWindow,
    });
  });

  setTimeout(() => {
    mainWindow.loadFile(
      path.join(
        process.resourcesPath,
        "app.asar",
        "customs-accounting",
        "dist",
        "public",
        "index.html"
      )
    );
  }, 3000);
}

function setupApplicationMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { type: "separator" },
        { role: "quit", label: "Exit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "toggleDevTools", label: "Developer Tools" },
        { role: "resetZoom", label: "Reset Zoom" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Full Screen" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendUpdateStatus(channel, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on("checking-for-update", () => {
  sendUpdateStatus("update-checking");
});

autoUpdater.on("update-available", (info) => {
  updateInfo = info;
  updateDownloaded = false;
  sendUpdateStatus("update-available", info);
});

autoUpdater.on("update-not-available", (info) => {
  updateInfo = info;
  updateDownloaded = false;
  sendUpdateStatus("update-not-available", info);
});

autoUpdater.on("download-progress", (progress) => {
  sendUpdateStatus("update-download-progress", progress);
});

autoUpdater.on("update-downloaded", (info) => {
  updateInfo = info;
  updateDownloaded = true;
  sendUpdateStatus("update-downloaded", info);
});

autoUpdater.on("error", (error) => {
  sendUpdateStatus("update-error", {
    message: error?.message || String(error),
  });
});

ipcMain.handle("save-current-page-pdf", async (event, fileName) => {
  try {
    if (!mainWindow) {
      throw new Error("Main window not found");
    }

    const safeName = safeFileName(fileName);
    const defaultPath = path.join(app.getPath("documents"), `${safeName}.pdf`);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "حفظ ملف PDF",
      defaultPath,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    const pdfBuffer = await mainWindow.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      marginsType: 1,
      landscape: false,
    });

    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath };
  } catch (error) {
    console.error("PDF save error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) {
    const payload = { message: "Updates are only available in the packaged app." };
    sendUpdateStatus("update-error", payload);
    return { success: false, ...payload };
  }

  updateDownloaded = false;
  const result = await autoUpdater.checkForUpdates();
  return { success: true, updateInfo: result?.updateInfo || updateInfo || null };
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) {
    const payload = { message: "Updates are only available in the packaged app." };
    sendUpdateStatus("update-error", payload);
    return { success: false, ...payload };
  }

  const files = await autoUpdater.downloadUpdate();
  return { success: true, files };
});

ipcMain.handle("install-update", async () => {
  if (!updateDownloaded) {
    return { success: false, message: "No downloaded update is ready to install." };
  }

  autoUpdater.quitAndInstall(false, true);
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();
  setupApplicationMenu();
});

app.on("window-all-closed", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  app.quit();
});
