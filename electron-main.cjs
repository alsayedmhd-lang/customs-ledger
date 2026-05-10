const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let backendProcess;
let mainWindow;
let updateInfo;
let updateDownloaded = false;
const MIN_ZOOM_FACTOR = 0.5;
const MAX_ZOOM_FACTOR = 3;
const ZOOM_STEP = 0.1;

function clampZoomFactor(value) {
  const zoomFactor = Number(value);
  if (!Number.isFinite(zoomFactor)) return 1;
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, zoomFactor));
}

function getUserPreferencesPath() {
  return path.join(app.getPath("userData"), "user-preferences.json");
}

function readUserPreferences() {
  const preferencesPath = getUserPreferencesPath();

  try {
    if (!fs.existsSync(preferencesPath)) {
      return { zoomFactor: 1 };
    }

    const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
    return {
      ...preferences,
      zoomFactor: clampZoomFactor(preferences?.zoomFactor),
    };
  } catch (error) {
    console.error("Failed to read user preferences:", error);
    return { zoomFactor: 1 };
  }
}

function saveUserPreferences(nextPreferences) {
  const preferencesPath = getUserPreferencesPath();

  try {
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    fs.writeFileSync(
      preferencesPath,
      JSON.stringify(
        {
          ...readUserPreferences(),
          ...nextPreferences,
          zoomFactor: clampZoomFactor(nextPreferences.zoomFactor),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Failed to save user preferences:", error);
  }
}

function setAppZoomFactor(zoomFactor, options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const nextZoomFactor = Number(clampZoomFactor(zoomFactor).toFixed(2));
  mainWindow.webContents.setZoomFactor(nextZoomFactor);

  if (options.save !== false) {
    saveUserPreferences({ zoomFactor: nextZoomFactor });
  }
}

function adjustAppZoom(direction) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (direction !== "in" && direction !== "out") return;

  const currentZoomFactor = mainWindow.webContents.getZoomFactor();
  const delta = direction === "in" ? ZOOM_STEP : -ZOOM_STEP;
  setAppZoomFactor(currentZoomFactor + delta);
}

function safeFileName(name) {
  return String(name || "document")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function safeRelativePath(relativePath) {
  if (typeof relativePath !== "string") return null;

  const normalized = path.normalize(relativePath).replace(/^([\\/])+/, "");
  if (!normalized || path.isAbsolute(normalized) || normalized.startsWith("..") || normalized.includes(`..${path.sep}`)) {
    return null;
  }

  return normalized;
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeDeclarationBaseNumber(value) {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();

  return cleaned || null;
}

function safeStoredAttachmentName(value) {
  const name = String(value || "").trim();

  if (
    !name ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    path.basename(name) !== name
  ) {
    return null;
  }

  return name;
}

function getAttachmentRelativePath(...segments) {
  return path.join("attachments", ...segments);
}

function getAttachmentFileMetadata(filePath) {
  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();

  return {
    filePath,
    fileName: path.basename(filePath),
    size: stats.size,
    ext,
  };
}

function resolveExternalFilePath(relativePath) {
  const safePath = safeRelativePath(relativePath);
  if (!safePath) return null;

  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, "customs-accounting", "dist", "public", safePath),
        path.join(process.resourcesPath, "app.asar", "customs-accounting", "dist", "public", safePath),
      ]
    : [
        path.join(__dirname, "customs-accounting", "dist", "public", safePath),
        path.join(__dirname, "customs-accounting", "public", safePath),
      ];

  const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) return null;

  if (!sourcePath.includes(".asar")) return sourcePath;

  const externalPath = path.join(app.getPath("userData"), "external-files", safePath);
  fs.mkdirSync(path.dirname(externalPath), { recursive: true });
  fs.copyFileSync(sourcePath, externalPath);
  return externalPath;
}

function appendBackendLog(message) {
  try {
    const logPath = path.join(app.getPath("userData"), "backend.log");
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch (error) {
    console.error("Failed to write backend log:", error);
  }
}

function startBackend({ apiPath, serverFile, appDataDbPath }) {
  console.log("Starting backend from:", serverFile);
  console.log("Using SQLite DB:", appDataDbPath);
  appendBackendLog(`Starting backend: exe=${process.execPath}`);
  appendBackendLog(`Backend script: ${serverFile}`);
  appendBackendLog(`Backend cwd: ${apiPath}`);

  backendProcess = spawn(process.execPath, [serverFile], {
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
  });

  backendProcess.stdout.on("data", (data) => {
    const output = data.toString();
    console.log("API:", output);
    appendBackendLog(`API: ${output.trimEnd()}`);
  });

  backendProcess.stderr.on("data", (data) => {
    const output = data.toString();
    console.error("API ERR:", output);
    appendBackendLog(`API ERR: ${output.trimEnd()}`);
  });

  backendProcess.on("error", (err) => {
    console.error("Backend process error:", err);
    appendBackendLog(`Backend process error: ${err?.stack || err}`);
  });

  backendProcess.on("exit", (code, signal) => {
    console.error("Backend process exited:", { code, signal });
    appendBackendLog(`Backend process exited: code=${code} signal=${signal}`);
  });
}

function resolveDataRoot() {
  const userDataPath = app.getPath("userData");
  const configPath = path.join(userDataPath, "storage-config.json");
  const legacyDbPath = path.join(userDataPath, "local.db");

  let dataRoot = userDataPath;

  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(raw);

      if (config && typeof config.dataRoot === "string" && config.dataRoot.trim()) {
        dataRoot = config.dataRoot.trim();
      }
    } else if (!fs.existsSync(legacyDbPath)) {
      const bestDataRoot = detectBestDataDrive();

      if (bestDataRoot) {
        fs.mkdirSync(bestDataRoot, { recursive: true });

        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }

        const storageConfig = {
          dataRoot: bestDataRoot,
          createdAt: new Date().toISOString(),
          createdBy: "auto-first-run",
          version: 1,
        };

        fs.writeFileSync(configPath, `${JSON.stringify(storageConfig, null, 2)}\n`, "utf8");
        dataRoot = bestDataRoot;
      }
    }
  } catch (error) {
    console.warn("[DATA_ROOT] Failed to read storage-config.json, falling back to userData", error);
    dataRoot = userDataPath;
  }

  if (!fs.existsSync(dataRoot)) {
    fs.mkdirSync(dataRoot, { recursive: true });
  }

  ensureDataRootFolders(dataRoot);

  return dataRoot;
}

function ensureDataRootFolders(dataRoot) {
  const folders = ["database", "attachments", "backups", "license", "logs", "config"];

  for (const folder of folders) {
    const folderPath = path.join(dataRoot, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }
}

function detectBestDataDrive() {
  const driveLetters = "DEFGHIJKLMNOPQRSTUVWXYZ";

  for (const letter of driveLetters) {
    const driveRoot = `${letter}:\\`;
    const probePath = path.join(driveRoot, `.customs-ledger-write-test-${process.pid}-${Date.now()}`);

    try {
      if (!fs.existsSync(driveRoot)) {
        continue;
      }

      fs.writeFileSync(probePath, "test");
      fs.unlinkSync(probePath);

      return path.join(driveRoot, "CustomsLedgerData");
    } catch (error) {
      try {
        if (fs.existsSync(probePath)) {
          fs.unlinkSync(probePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors while probing available data drives.
      }
    }
  }

  return null;
}

function getAttachmentsRoot() {
  return path.join(resolveDataRoot(), "attachments");
}

function createWindow() {
  const basePath = process.resourcesPath;
  const apiPath = path.join(basePath, "api-server");
  const serverFile = path.join(apiPath, "dist", "index.cjs");
  const starterDbPath = path.join(apiPath, "lib", "db", "local.db");
  const userDataPath = resolveDataRoot();
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

  startBackend({ apiPath, serverFile, appDataDbPath });

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

  const userPreferences = readUserPreferences();
  saveUserPreferences({ zoomFactor: userPreferences.zoomFactor });
  setAppZoomFactor(userPreferences.zoomFactor, { save: false });

  mainWindow.webContents.on("did-finish-load", () => {
    setAppZoomFactor(readUserPreferences().zoomFactor, { save: false });
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
    const indexPath = path.join(
      process.resourcesPath,
      "app.asar",
      "customs-accounting",
      "dist",
      "public",
      "index.html"
    );
    console.log("FRONTEND INDEX PATH =", indexPath);
    mainWindow.loadFile(indexPath);
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
        {
          label: "Reset Zoom",
          accelerator: "CommandOrControl+0",
          click: () => setAppZoomFactor(1),
        },
        {
          label: "Zoom In",
          accelerator: "CommandOrControl+=",
          click: () => adjustAppZoom("in"),
        },
        {
          label: "Zoom Out",
          accelerator: "CommandOrControl+-",
          click: () => adjustAppZoom("out"),
        },
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

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("open-external-file", async (_event, relativePath) => {
  try {
    const filePath = resolveExternalFilePath(relativePath);
    if (!filePath) {
      return { success: false, error: "File not found" };
    }

    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) {
      return { success: false, error: errorMessage };
    }

    return { success: true, filePath };
  } catch (error) {
    console.error("External file open error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("attachments:select-file", async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { canceled: true, error: "Main window not found" };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Supported Attachments",
          extensions: ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"],
        },
      ],
    });

    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true };
    }

    return {
      canceled: false,
      ...getAttachmentFileMetadata(result.filePaths[0]),
    };
  } catch (error) {
    console.error("Attachment select error:", error);
    return { canceled: true, error: error.message };
  }
});

ipcMain.handle("attachment:save-file", async (_event, payload = {}) => {
  try {
    const sourcePath = String(payload.sourcePath || "");
    const declarationBaseNumber = safeDeclarationBaseNumber(payload.declarationBaseNumber);
    const storedName = safeStoredAttachmentName(payload.storedName);

    if (!sourcePath || !path.isAbsolute(sourcePath)) {
      return { ok: false, error: "sourcePath must be an absolute path" };
    }

    if (!declarationBaseNumber) {
      return { ok: false, error: "Invalid declarationBaseNumber" };
    }

    if (!storedName) {
      return { ok: false, error: "Invalid storedName" };
    }

    const sourceStats = fs.existsSync(sourcePath) ? fs.statSync(sourcePath) : null;
    if (!sourceStats?.isFile()) {
      return { ok: false, error: "Source file not found" };
    }

    const attachmentsRoot = getAttachmentsRoot();
    const targetDir = path.resolve(attachmentsRoot, "declarations", declarationBaseNumber);
    const targetPath = path.resolve(targetDir, storedName);

    if (!isPathInside(attachmentsRoot, targetPath)) {
      return { ok: false, error: "Invalid attachment path" };
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);

    return {
      ok: true,
      relativePath: getAttachmentRelativePath("declarations", declarationBaseNumber, storedName),
      fullPath: targetPath,
    };
  } catch (error) {
    console.error("Attachment save error:", error);
    return { ok: false, error: error.message };
  }
});

ipcMain.handle("attachment:open-file", async (_event, relativePath) => {
  try {
    const safePath = safeRelativePath(relativePath);
    if (!safePath) {
      return { ok: false, error: "Invalid attachment path" };
    }

    const attachmentsRoot = getAttachmentsRoot();
    const targetPath = path.resolve(app.getPath("userData"), safePath);

    if (!isPathInside(attachmentsRoot, targetPath)) {
      return { ok: false, error: "Attachment path is outside storage root" };
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      return { ok: false, error: "Attachment file not found" };
    }

    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) {
      return { ok: false, error: errorMessage };
    }

    return { ok: true, fullPath: targetPath };
  } catch (error) {
    console.error("Attachment open error:", error);
    return { ok: false, error: error.message };
  }
});

ipcMain.on("app:zoom-wheel", (event, direction) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (event.sender !== mainWindow.webContents) return;

  adjustAppZoom(direction);
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
