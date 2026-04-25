const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let backendProcess;

function createWindow() {
  const backendEntry = path.join(
    process.resourcesPath,
    "api-server",
    "dist",
    "index.cjs"
  );

  const backendCwd = path.join(process.resourcesPath, "api-server");

  backendProcess = spawn(
    "node",
    [backendEntry],
    {
      cwd: backendCwd,
      windowsHide: true,
      stdio: "inherit",
      detached: false,
    }
  );
  backendProcess.on("error", (err) => {
    console.error("Backend process error:", err);
  });

  backendProcess.on("exit", (code, signal) => {
    console.error("Backend process exited:", { code, signal });
  });

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // افتح DevTools مؤقتًا فقط للفحص
  // win.webContents.openDevTools();

  setTimeout(() => {
    win.loadFile(
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

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  app.quit();
});