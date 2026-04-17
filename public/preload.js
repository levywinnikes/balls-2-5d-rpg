const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveGame: (name, data) => ipcRenderer.invoke("save-game", { name, data }),
  loadGame: (name) => ipcRenderer.invoke("load-game", name),
  listSaves: () => ipcRenderer.invoke("list-saves"),
  deleteGame: (name) => ipcRenderer.invoke("delete-game", name),
  writeBenchmarkReport: (reportPath, data) =>
    ipcRenderer.invoke("benchmark-write-report", { reportPath, data }),
  exitBenchmarkRun: (exitCode) =>
    ipcRenderer.invoke("benchmark-exit", { exitCode }),
});
