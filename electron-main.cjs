const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let backendProcess;
let mainWindow;

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

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  app.quit();
});
