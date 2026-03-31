require('dotenv').config();

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { listDevices, startCapture } = require('./audio/capture');
const { transcribe } = require('./ai/whisper');
const { analyze }   = require('./ai/claude');
const {
  getResume, setResume,
  addToSession, getSession, clearSession,
  getSettings, updateSettings
} = require('./store/context');

let win;
let captureStream = null;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 480,
    height: 680,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Global hotkey: Ctrl+Shift+Space — toggle overlay visibility (stealth mode)
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.isVisible() ? win.hide() : win.show();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (captureStream) captureStream.quit();
  app.quit();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runPipeline(text) {
  const { minWords } = getSettings();
  const words = text.trim().split(/\s+/).length;
  if (!text.trim() || words < minWords) return;

  win.webContents.send('new-result', { text, result: null });

  try {
    win.webContents.send('status', 'Analyzing: ' + text.slice(0, 40));
    const result = await analyze(text, getResume());
    addToSession({ text, result });
    win.webContents.send('new-result', { text, result });
    win.webContents.send('status', 'Listening...');
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[claude error]', detail);
    win.webContents.send('status', 'Claude error: ' + detail.slice(0, 60));
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-devices', () => listDevices());

ipcMain.handle('set-resume', (_, text) => setResume(text));

// Start audio capture → Whisper → Claude pipeline
ipcMain.handle('start-capture', async (_, deviceId) => {
  if (captureStream) return;

  const { chunkCount } = getSettings();
  win.webContents.send('status', 'Listening...');

  captureStream = startCapture(deviceId, chunkCount, async (chunk) => {
    let text;
    try {
      win.webContents.send('status', 'Transcribing...');
      text = await transcribe(chunk);
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      console.error('[whisper error]', detail);
      win.webContents.send('status', 'Whisper error: ' + detail.slice(0, 60));
      return;
    }
    await runPipeline(text);
  });
});

ipcMain.handle('stop-capture', () => {
  if (captureStream) {
    captureStream.quit();
    captureStream = null;
    win.webContents.send('status', 'Stopped.');
  }
});

// Manual question input (mock interview mode — skips Whisper)
ipcMain.handle('ask-manual', async (_, text) => {
  if (!text || !text.trim()) return;
  await runPipeline(text.trim());
});

// Save session to Desktop as JSON
ipcMain.handle('save-session', () => {
  const session = getSession();
  if (!session.length) return { ok: false, msg: 'No session data yet.' };

  const date   = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const file   = path.join(os.homedir(), 'Desktop', `gamedev-session-${date}.json`);
  const data   = JSON.stringify(session, null, 2);
  fs.writeFileSync(file, data, 'utf-8');
  return { ok: true, file };
});

// Settings
ipcMain.handle('get-settings',    ()        => getSettings());
ipcMain.handle('update-settings', (_, patch) => updateSettings(patch));
