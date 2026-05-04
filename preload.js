const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
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
