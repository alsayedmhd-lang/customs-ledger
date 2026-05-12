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
      APP_DATA_ROOT: path.dirname(path.dirname(appDataDbPath)),
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
    } else {
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

        const dataRootConfigPath = path.join(bestDataRoot, "config", "storage-config.json");
        fs.mkdirSync(path.dirname(dataRootConfigPath), { recursive: true });
        fs.writeFileSync(dataRootConfigPath, `${JSON.stringify(storageConfig, null, 2)}\n`, "utf8");

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
function getResolvedDatabasePath() {
  const dataRoot = resolveDataRoot();
  const databaseDir = path.join(dataRoot, "database");

  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }

  return path.join(databaseDir, "local.db");
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

function analyzeDataRootMigration() {
  const sourceRoot = resolveDataRoot();
  const targetRoot = detectBestDataDrive();
  const warnings = [];
  let targetWritable = false;

  const items = [
    { name: "local.db", type: "file" },
    { name: "attachments", type: "folder" },
    { name: "backups", type: "folder" },
    { name: "license", type: "folder" },
    { name: "logs", type: "folder" },
    { name: "config", type: "folder" },
  ].map((item) => {
    const itemPath =
  item.name === "local.db"
    ? path.join(sourceRoot, "database", "local.db")
    : path.join(sourceRoot, item.name);

    return {
      name: item.name,
      path: itemPath,
      exists: fs.existsSync(itemPath),
      type: item.type,
    };
  });

  if (!targetRoot) {
    warnings.push("No suitable target drive detected");

    return {
      canAnalyze: true,
      sourceRoot,
      targetRoot: null,
      targetWritable,
      items,
      warnings,
    };
  }

  const probePath = path.join(targetRoot, `.customs-ledger-migration-test-${process.pid}-${Date.now()}`);

  try {
    if (!fs.existsSync(targetRoot)) {
      fs.mkdirSync(targetRoot, { recursive: true });
    }

    fs.writeFileSync(probePath, "test");
    fs.unlinkSync(probePath);
    targetWritable = true;
  } catch (error) {
    warnings.push(`Target root is not writable: ${error?.message || error}`);

    try {
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    } catch (cleanupError) {
      warnings.push(`Failed to clean up target write test: ${cleanupError?.message || cleanupError}`);
    }
  }

  return {
    canAnalyze: true,
    sourceRoot,
    targetRoot,
    targetWritable,
    items,
    warnings,
  };
}

function analyzeBackupReadiness() {
  const warnings = [];
  const dataRoot = resolveDataRoot();
  const databasePath = path.join(dataRoot, "local.db");
  const backupsRoot = path.join(dataRoot, "backups");
  const databaseExists = fs.existsSync(databasePath);
  let databaseReadable = false;
  let databaseSizeBytes = 0;
  let backupsRootExists = false;
  let backupsRootWritable = false;

  if (databaseExists) {
    try {
      const databaseHandle = fs.openSync(databasePath, "r");
      fs.closeSync(databaseHandle);
      databaseReadable = true;
    } catch (error) {
      warnings.push(`Database is not readable: ${error?.message || error}`);
    }

    try {
      databaseSizeBytes = fs.statSync(databasePath).size;
    } catch (error) {
      warnings.push(`Could not read database size: ${error?.message || error}`);
    }
  } else {
    warnings.push("Database file does not exist");
  }

  try {
    if (!fs.existsSync(backupsRoot)) {
      fs.mkdirSync(backupsRoot, { recursive: true });
    }

    backupsRootExists = fs.existsSync(backupsRoot);
  } catch (error) {
    warnings.push(`Could not create backups root: ${error?.message || error}`);
  }

  const probePath = path.join(backupsRoot, `.customs-ledger-backup-test-${process.pid}-${Date.now()}`);

  try {
    if (backupsRootExists) {
      fs.writeFileSync(probePath, "test");
      fs.unlinkSync(probePath);
      backupsRootWritable = true;
    }
  } catch (error) {
    warnings.push(`Backups root is not writable: ${error?.message || error}`);

    try {
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    } catch (cleanupError) {
      warnings.push(`Failed to clean up backup write test: ${cleanupError?.message || cleanupError}`);
    }
  }

  return {
    ok: databaseExists && databaseReadable && backupsRootWritable,
    dataRoot,
    databasePath,
    databaseExists,
    databaseReadable,
    databaseSizeBytes,
    backupsRoot,
    backupsRootExists,
    backupsRootWritable,
    warnings,
  };
}

function createBackupManifest() {
  const dataRoot = resolveDataRoot();
  const timestamp = new Date().toISOString();
  const backupId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const databasePath = path.join(dataRoot, "local.db");
  const attachmentsPath = path.join(dataRoot, "attachments");
  const backupsRoot = path.join(dataRoot, "backups");
  let databaseExists = false;
  let databaseSizeBytes = 0;
  let attachmentsExists = false;

  try {
    databaseExists = fs.existsSync(databasePath);
  } catch (error) {
    databaseExists = false;
  }

  if (databaseExists) {
    try {
      databaseSizeBytes = fs.statSync(databasePath).size;
    } catch (error) {
      databaseSizeBytes = 0;
    }
  }

  try {
    attachmentsExists = fs.existsSync(attachmentsPath);
  } catch (error) {
    attachmentsExists = false;
  }

  return {
    backupId,
    createdAt: timestamp,
    appVersion: app.getVersion(),
    platform: process.platform,
    dataRoot,
    database: {
      path: databasePath,
      exists: databaseExists,
      sizeBytes: databaseSizeBytes,
    },
    attachments: {
      path: attachmentsPath,
      exists: attachmentsExists,
    },
    backup: {
      formatVersion: 1,
      type: "full",
      compression: "none",
    },
  };
}

function createBackupDirectory() {
  const manifest = createBackupManifest();
  const dataRoot = manifest.dataRoot;
  const backupsRoot = path.join(dataRoot, "backups");

  if (!fs.existsSync(backupsRoot)) {
    fs.mkdirSync(backupsRoot, { recursive: true });
  }

  const folderName = `backup-${manifest.createdAt.replace(/[:.]/g, "-")}-${manifest.backupId}`;
  const backupDir = path.join(backupsRoot, folderName);
  fs.mkdirSync(backupDir, { recursive: true });

  const manifestPath = path.join(backupDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const sourceDbPath = manifest.database.path;
  const targetDbPath = path.join(backupDir, "local.db");
  let databasePath = null;
  let databaseCopied = false;
  let databaseSizeBytes = 0;

  if (manifest.database.exists) {
    fs.copyFileSync(sourceDbPath, targetDbPath);

    const sourceSizeBytes = fs.statSync(sourceDbPath).size;
    const targetSizeBytes = fs.statSync(targetDbPath).size;

    if (sourceSizeBytes !== targetSizeBytes) {
      throw new Error("Database backup verification failed: size mismatch");
    }

    databasePath = targetDbPath;
    databaseCopied = true;
    databaseSizeBytes = targetSizeBytes;
  }

  return {
    ok: true,
    backupDir,
    manifestPath,
    databasePath,
    databaseCopied,
    databaseSizeBytes,
    manifest,
  };
}

function verifyBackupDirectory(backupDir) {
  try {
    if (!backupDir) {
      throw new Error("Backup directory is required");
    }

    if (!fs.existsSync(backupDir)) {
      throw new Error("Backup directory not found");
    }

    const manifestPath = path.join(backupDir, "manifest.json");
    const databasePath = path.join(backupDir, "local.db");

    if (!fs.existsSync(manifestPath)) {
      throw new Error("Backup manifest not found");
    }

    if (!fs.existsSync(databasePath)) {
      throw new Error("Backup database not found");
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    if (!manifest.backup) {
      throw new Error("Backup manifest is missing backup metadata");
    }

    if (!manifest.createdAt) {
      throw new Error("Backup manifest is missing createdAt");
    }

    if (manifest.backup.formatVersion !== 1) {
      throw new Error("Unsupported backup manifest formatVersion");
    }

    const databaseSizeBytes = fs.statSync(databasePath).size;

    if (databaseSizeBytes <= 0) {
      throw new Error("Backup database is empty");
    }

    return {
      ok: true,
      verified: true,
      backupDir,
      databaseSizeBytes,
      manifest,
      warnings: [],
    };
  } catch (error) {
    return {
      ok: false,
      verified: false,
      backupDir,
      error: error?.message || String(error),
    };
  }
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
  const appDataDbPath = getResolvedDatabasePath();

  appendBackendLog(`Resolved starter DB: ${starterDbPath}`);
  appendBackendLog(`Starter DB exists: ${fs.existsSync(starterDbPath)}`);
  appendBackendLog(`Resolved app DB: ${appDataDbPath}`);

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
    if (!app.isPackaged) {
      console.log("FRONTEND INDEX PATH =", frontendPath);
    }
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

ipcMain.handle("storage:open-data-folder", async () => {
  try {
    const { shell } = require("electron");

    const { resolveDataRoot } = require("./api-server/dist/utils/storage/resolve-data-root");

    const dataRoot = resolveDataRoot();

    await shell.openPath(dataRoot);

    return { ok: true, dataRoot };
  } catch (error) {
    console.error("[DATA ROOT][OPEN ERROR]", error);

    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("data-root:analyze-migration", async () => {
  try {
    return {
      ok: true,
      report: analyzeDataRootMigration(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("backup:analyze-readiness", async () => {
  try {
    return {
      ok: true,
      report: analyzeBackupReadiness(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("backup:create-manifest", async () => {
  try {
    return {
      ok: true,
      manifest: createBackupManifest(),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("backup:create-directory", async () => {
  try {
    return createBackupDirectory();
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("backup:verify-directory", async (_event, backupDir) => {
  try {
    return verifyBackupDirectory(backupDir);
  } catch (error) {
    return {
      ok: false,
      verified: false,
      backupDir,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("storage:test-write", async (_event, targetPath) => {
  try {
    const fs = require("fs");
    const path = require("path");

    const normalizedTarget = path.resolve(targetPath).toLowerCase();

    const blockedPaths = [
      "c:\\windows",
      "c:\\program files",
      "c:\\program files (x86)",
    ];

    if (blockedPaths.some((blockedPath) => normalizedTarget.startsWith(blockedPath))) {
      return {
        ok: false,
        writable: false,
        path: targetPath,
        error: "This folder is protected and cannot be used as Data Root",
      };
    }

    const testFilePath = path.join(
      targetPath,
      `.write-test-${Date.now()}.tmp`
    );

    fs.writeFileSync(testFilePath, "Customs Ledger Write Test", "utf8");

    const exists = fs.existsSync(testFilePath);

    if (!exists) {
      throw new Error("Write test failed");
    }

    fs.unlinkSync(testFilePath);

    return {
      ok: true,
      writable: true,
      path: targetPath,
    };
  } catch (error) {
    console.error("[DATA ROOT][WRITE TEST ERROR]", error);

    return {
      ok: false,
      writable: false,
      path: targetPath,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("storage:choose-data-root", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Choose Data Root Folder",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || !result.filePaths?.[0]) {
      return {
        ok: false,
        canceled: true,
      };
    }

    return {
      ok: true,
      canceled: false,
      path: result.filePaths[0],
    };
  } catch (error) {
    console.error("[DATA ROOT][CHOOSE FOLDER ERROR]", error);

    return {
      ok: false,
      canceled: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("storage:save-data-root", async (_event, targetPath) => {
  try {
    const fs = require("fs");
    const path = require("path");

    const configDir = path.join(targetPath, "config");
    const configPath = path.join(configDir, "storage-config.json");

    fs.mkdirSync(configDir, { recursive: true });

    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          dataRoot: targetPath,
          updatedAt: new Date().toISOString(),
          source: "developer-settings",
        },
        null,
        2
      ),
      "utf8"
    );

    return {
      ok: true,
      configPath,
      dataRoot: targetPath,
    };
  } catch (error) {
    console.error("[DATA ROOT][SAVE CONFIG ERROR]", error);

    return {
      ok: false,
      error: error?.message || String(error),
    };
  }
});

ipcMain.handle("open-external-file", async (_event, relativePath) => {
  try {
    let filePath = relativePath;

    if (!path.isAbsolute(filePath)) {
      filePath = resolveExternalFilePath(relativePath);
    }

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
