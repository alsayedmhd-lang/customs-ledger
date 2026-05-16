const { contextBridge, ipcRenderer } = require("electron");

const PRINT_AUTH_TOKEN_ARG = "--customs-print-auth-token-base64=";
const printAuthTokenArg = process.argv.find((arg) =>
  arg.startsWith(PRINT_AUTH_TOKEN_ARG)
);

if (printAuthTokenArg) {
  try {
    const encodedToken = printAuthTokenArg.slice(PRINT_AUTH_TOKEN_ARG.length);
    const token = Buffer.from(encodedToken, "base64").toString("utf8");

    if (token) {
      sessionStorage.setItem("auth_token", token);
    }
  } catch {
    // Ignore invalid print-preview auth bootstrap data.
  }
}

window.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey || event.deltaY === 0) return;

    event.preventDefault();
    ipcRenderer.send("app:zoom-wheel", event.deltaY < 0 ? "in" : "out");
  },
  { passive: false }
);

contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),

  developerUnlock: (password) =>
    ipcRenderer.invoke("developer:unlock", password),

  getLicenseDeviceId: () =>
    ipcRenderer.invoke("license:get-device-id"),

  getLicenseStatus: () =>
    ipcRenderer.invoke("license:get-status"),

  saveCurrentLicense: (license) =>
    ipcRenderer.invoke("license:save-current", license),

  createSignedLicense: (license) =>
    ipcRenderer.invoke("license:create-signed", license),
  analyzeDataRootMigration: () => ipcRenderer.invoke("data-root:analyze-migration"),
  analyzeBackupReadiness: () => ipcRenderer.invoke("backup:analyze-readiness"),
  createBackupManifest: () => ipcRenderer.invoke("backup:create-manifest"),
  createBackupDirectory: () => ipcRenderer.invoke("backup:create-directory"),
  verifyBackupDirectory: (backupDir) =>
    ipcRenderer.invoke("backup:verify-directory", backupDir),
  openExternalFile: (relativePath) =>
  ipcRenderer.invoke("open-external-file", relativePath),

  openDataFolder: () => {
    return ipcRenderer.invoke("storage:open-data-folder");
  },

  testDataRootWrite: (targetPath) => {
    return ipcRenderer.invoke("storage:test-write", targetPath);
  },
  chooseDataRootFolder: () => {
    return ipcRenderer.invoke("storage:choose-data-root");
  },
  saveDataRootConfig: (targetPath) => {
    return ipcRenderer.invoke("storage:save-data-root", targetPath);
  },
  saveCurrentDataRootConfig: (expectedDataRoot) => {
    return ipcRenderer.invoke("storage:save-current-data-root", expectedDataRoot);
  },

  selectAttachmentFile: () => ipcRenderer.invoke("attachments:select-file"),
  saveAttachmentFile: ({ sourcePath, declarationBaseNumber, storedName }) =>
    ipcRenderer.invoke("attachment:save-file", {
      sourcePath,
      declarationBaseNumber,
      storedName,
    }),
  openAttachmentFile: (payload) =>
    ipcRenderer.invoke("attachment:open-file", payload),
  saveCurrentPagePDF: (fileName) =>
    ipcRenderer.invoke("save-current-page-pdf", fileName),
  openExternalPrintWindow: (url) =>
    ipcRenderer.invoke("print-preview:open-external-window", url),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  onUpdateStatus: (callback) => {
    const channels = [
      "update-checking",
      "update-available",
      "update-not-available",
      "update-download-progress",
      "update-downloaded",
      "update-error",
    ];

    const listeners = channels.map((channel) => {
      const listener = (_event, payload) => callback({ channel, payload });
      ipcRenderer.on(channel, listener);
      return { channel, listener };
    });

    return () => {
      listeners.forEach(({ channel, listener }) => {
        ipcRenderer.removeListener(channel, listener);
      });
    };
  },
});


