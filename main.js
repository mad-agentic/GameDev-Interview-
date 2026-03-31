require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { listDevices, startCapture } = require('./audio/capture');
const { transcribe } = require('./ai/whisper');
const { analyze } = require('./ai/claude');
const { getResume, setResume } = require('./store/context');

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
});

app.on('window-all-closed', () => {
  if (captureStream) captureStream.quit();
  app.quit();
});

// List available audio input devices
ipcMain.handle('get-devices', () => listDevices());

// Save resume text for personalization
ipcMain.handle('set-resume', (_, text) => {
  setResume(text);
});

// Start audio capture → Whisper → Claude pipeline
ipcMain.handle('start-capture', async (_, deviceId) => {
  if (captureStream) return;

  win.webContents.send('status', 'Listening...');

  captureStream = startCapture(deviceId, async (chunk) => {
    let text;
    try {
      win.webContents.send('status', 'Transcribing...');
      text = await transcribe(chunk);
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      console.error('[whisper 401?]', detail);
      win.webContents.send('status', 'Whisper error: ' + detail);
      return;
    }

    // Skip empty or very short transcripts (noise, single words, music fragments)
    const words = text.trim().split(/\s+/).length;
    if (!text.trim() || words < 4) {
      win.webContents.send('status', 'Listening...');
      return;
    }

    // Show transcript immediately, even if Claude fails
    win.webContents.send('new-result', { text, result: null });

    try {
      win.webContents.send('status', 'Analyzing: ' + text.slice(0, 40));
      const result = await analyze(text, getResume());
      win.webContents.send('new-result', { text, result });
      win.webContents.send('status', 'Listening...');
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      console.error('[claude error]', detail);
      win.webContents.send('status', 'Claude error: ' + detail.slice(0, 60));
    }
  });
});

// Stop audio capture
ipcMain.handle('stop-capture', () => {
  if (captureStream) {
    captureStream.quit();
    captureStream = null;
    win.webContents.send('status', 'Stopped.');
  }
});
