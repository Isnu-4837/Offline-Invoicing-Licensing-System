const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkTrialStatus: () => ipcRenderer.invoke('check-trial'),
  startTrial: () => ipcRenderer.invoke('start-trial'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  getMachineId: () => ipcRenderer.invoke('get-machine-id')
});