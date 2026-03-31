const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('copilot', {
  getDevices:   ()      => ipcRenderer.invoke('get-devices'),
  startCapture: (id)    => ipcRenderer.invoke('start-capture', id),
  stopCapture:  ()      => ipcRenderer.invoke('stop-capture'),
  setResume:    (text)  => ipcRenderer.invoke('set-resume', text),
  onResult:     (cb)    => ipcRenderer.on('new-result', (_, data) => cb(data)),
  onStatus:     (cb)    => ipcRenderer.on('status', (_, msg) => cb(msg))
});
