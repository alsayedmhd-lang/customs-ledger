const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveCurrentPagePDF: (fileName) =>
    ipcRenderer.invoke("save-current-page-pdf", fileName),
});