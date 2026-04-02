const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('copilot', {
  // Audio
  getDevices:   ()      => ipcRenderer.invoke('get-devices'),
  startCapture: (id)    => ipcRenderer.invoke('start-capture', id),
  stopCapture:  ()      => ipcRenderer.invoke('stop-capture'),
  togglePause:  ()      => ipcRenderer.invoke('toggle-pause'),

  // Resume
  setResume:    (text)  => ipcRenderer.invoke('set-resume', text),

  // Manual question (mock interview)
  askManual:    (text)  => ipcRenderer.invoke('ask-manual', text),
  translateText:(text)  => ipcRenderer.invoke('translate-text', text),

  // Session export
  saveSession:  ()      => ipcRenderer.invoke('save-session'),

  // Settings
  getSettings:      ()      => ipcRenderer.invoke('get-settings'),
  updateSettings:   (patch) => ipcRenderer.invoke('update-settings', patch),
  getEnvAiConfig:   ()      => ipcRenderer.invoke('get-env-ai-config'),

  // Window controls
  winMinimize: () => ipcRenderer.invoke('win-minimize'),
  winMaximize: () => ipcRenderer.invoke('win-maximize'),
  winHide:     () => ipcRenderer.invoke('win-hide'),

  // Screen capture
  getScreenSources: ()      => ipcRenderer.invoke('get-screen-sources'),
  submitAudioChunk: (buf)   => ipcRenderer.invoke('submit-audio-chunk', buf),

  // Screen CC mode (screenshot + Vision OCR)
  startScreenCC:       (id) => ipcRenderer.invoke('start-screen-cc', id),
  stopScreenCC:        ()   => ipcRenderer.invoke('stop-screen-cc'),

  // Clipboard CC mode
  startClipboardWatch: () => ipcRenderer.invoke('start-clipboard-watch'),
  stopClipboardWatch:  () => ipcRenderer.invoke('stop-clipboard-watch'),

  // Speaker diarization
  setMySpeaker:     (label) => ipcRenderer.invoke('set-my-speaker', label),

  // Manual analyze trigger
  analyzeNow:       ()      => ipcRenderer.invoke('analyze-now'),
  clearTranscript:  ()      => ipcRenderer.invoke('clear-transcript'),
  removeTranscriptEntry: (id) => ipcRenderer.invoke('remove-transcript-entry', id),
  setTranscriptEntryExcluded: (id, excluded) => ipcRenderer.invoke('set-transcript-entry-excluded', id, excluded),

  // CC region selection
  selectCCRegion:    ()     => ipcRenderer.invoke('select-cc-region'),
  getCCRegion:       ()     => ipcRenderer.invoke('get-cc-region'),
  clearCCRegion:     ()     => ipcRenderer.invoke('clear-cc-region'),

  // Events
  onTranscriptChunk:   (cb) => ipcRenderer.on('transcript-chunk',   (_, d) => cb(d)),
  onTranscriptMeta:    (cb) => ipcRenderer.on('transcript-meta',    (_, d) => cb(d)),
  onCcLiveText:        (cb) => ipcRenderer.on('cc-live-text',       (_, d) => cb(d)),
  onTranscriptCleared: (cb) => ipcRenderer.on('transcript-cleared', ()     => cb()),
  onRegionConfirmed:   (cb) => ipcRenderer.on('region-confirmed',   (_, r) => cb(r)),

  // Events
  onResult: (cb) => ipcRenderer.on('new-result', (_, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('status',     (_, msg)  => cb(msg))
});
