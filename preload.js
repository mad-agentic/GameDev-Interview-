const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('copilot', {
  // Audio
  getDevices:   ()      => ipcRenderer.invoke('get-devices'),
  startCapture: (id)    => ipcRenderer.invoke('start-capture', id),
  stopCapture:  ()      => ipcRenderer.invoke('stop-capture'),

  // Resume
  setResume:    (text)  => ipcRenderer.invoke('set-resume', text),

  // Manual question (mock interview)
  askManual:    (text)  => ipcRenderer.invoke('ask-manual', text),

  // Session export
  saveSession:  ()      => ipcRenderer.invoke('save-session'),

  // Settings
  getSettings:    ()      => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),

  // Events
  onResult: (cb) => ipcRenderer.on('new-result', (_, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status',     (_, msg)  => cb(msg))
});
