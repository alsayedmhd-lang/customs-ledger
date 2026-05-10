const { contextBridge, ipcRenderer } = require("electron");

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
  analyzeDataRootMigration: () => ipcRenderer.invoke("data-root:analyze-migration"),
  analyzeBackupReadiness: () => ipcRenderer.invoke("backup:analyze-readiness"),
  createBackupManifest: () => ipcRenderer.invoke("backup:create-manifest"),
  openExternalFile: (relativePath) =>
    ipcRenderer.invoke("open-external-file", relativePath),
  selectAttachmentFile: () => ipcRenderer.invoke("attachments:select-file"),
  saveAttachmentFile: ({ sourcePath, declarationBaseNumber, storedName }) =>
    ipcRenderer.invoke("attachment:save-file", {
      sourcePath,
      declarationBaseNumber,
      storedName,
    }),
  openAttachmentFile: (relativePath) =>
    ipcRenderer.invoke("attachment:open-file", relativePath),
  saveCurrentPagePDF: (fileName) =>
    ipcRenderer.invoke("save-current-page-pdf", fileName),
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
