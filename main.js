require('dotenv').config();

const { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, clipboard, screen: electronScreen } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { listDevices, startCapture } = require('./audio/capture');
const { transcribe, transcribeWebm } = require('./ai/whisper');
const { transcribeWithSpeakers }    = require('./ai/assemblyai');
const { extractCCText }             = require('./ai/vision');
const { translateBilingual }        = require('./ai/translate');
const { analyze }   = require('./ai/claude');
const {
  getResume, setResume,
  addToSession, getSession, clearSession,
  getSettings, updateSettings
} = require('./store/context');

let win;
let captureStream    = null;
let isPaused         = false;
let clipboardWatcher = null;
let lastClipText     = '';
let screenCCWatcher  = null;
let lastScreenText   = '';
let ccRegion         = null;   // { x, y, width, height }
let regionWin        = null;
let regionIndicatorWin = null;
const translateCache = new Map();
const SCREEN_CC_INTERVAL_MS = 700;

function safeStatus(msg) {
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send('status', String(msg || 'Unknown runtime error'));
    }
  } catch (_) { /* ignore nested failures */ }
}

// Keep the app alive and surface diagnostics instead of crashing the process.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  safeStatus('Runtime error: ' + (err?.message || 'Unknown error'));
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  const message = reason && reason.message ? reason.message : String(reason || 'Unknown rejection');
  safeStatus('Promise error: ' + message);
});

function normalizeCcText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function normalizeCcCompareText(text = '') {
  return normalizeCcText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '');
}

function getWordOverlapSuffixPrefix(prevText, currText) {
  const prevWords = normalizeCcCompareText(prevText).split(' ').filter(Boolean);
  const currWords = normalizeCcCompareText(currText).split(' ').filter(Boolean);
  if (!prevWords.length || !currWords.length) return 0;

  const maxK = Math.min(prevWords.length, currWords.length);
  for (let k = maxK; k >= 3; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (prevWords[prevWords.length - k + i] !== currWords[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return k;
  }
  return 0;
}

function getWordContainmentRatio(prevText, currText) {
  const prevWords = normalizeCcCompareText(prevText).split(' ').filter(Boolean);
  const currWords = normalizeCcCompareText(currText).split(' ').filter(Boolean);
  if (!prevWords.length || !currWords.length) return 0;

  const prevSet = new Set(prevWords);
  let common = 0;
  for (const w of currWords) {
    if (prevSet.has(w)) common++;
  }
  return common / currWords.length;
}

function extractNewCcDelta(previousText, currentText) {
  const prev = normalizeCcText(previousText);
  const curr = normalizeCcText(currentText);

  if (!curr) return '';
  if (!prev) return curr;
  if (curr === prev) return '';
  if (prev.includes(curr)) return '';

  // Most common case for captions: current snapshot contains full previous text.
  const directIdx = curr.indexOf(prev);
  if (directIdx >= 0) {
    return curr.slice(directIdx + prev.length).trim();
  }

  // Word-overlap fallback for rolling captions that reflow slightly between frames.
  const overlapWords = getWordOverlapSuffixPrefix(prev, curr);
  if (overlapWords > 0) {
    const currWordsRaw = curr.split(' ').filter(Boolean);
    const deltaWords = currWordsRaw.slice(overlapWords);
    return deltaWords.join(' ').trim();
  }

  // If OCR mostly repeats existing words, skip to avoid full-card replay spam.
  const containment = getWordContainmentRatio(prev, curr);
  if (containment >= 0.7) {
    return '';
  }

  // If text was replaced (new sentence/question), keep full current text.
  return curr;
}

// ── Transcript buffer (accumulates until user clicks Suggest) ─────────────────
let transcriptBuffer = []; // [{id, text, utterances, excluded}]
let transcriptEntrySeq = 1;

function getTranscriptWordCount(includeExcluded = true) {
  return transcriptBuffer
    .filter((e) => includeExcluded || !e.excluded)
    .reduce((n, e) => n + (e.text ? e.text.split(/\s+/).length : 0), 0);
}

function emitTranscriptMeta() {
  const totalWordCount = getTranscriptWordCount(true);
  const includedWordCount = getTranscriptWordCount(false);
  win.webContents.send('transcript-meta', {
    wordCount: includedWordCount,
    includedWordCount,
    totalWordCount,
    entryCount: transcriptBuffer.length,
    includedEntryCount: transcriptBuffer.filter((e) => !e.excluded).length
  });
}

function pushTranscript(text, utterances = null) {
  if (!text || !text.trim()) return;
  const { minWords } = getSettings();
  const words = text.trim().split(/\s+/);
  if (words.length < minWords) return;
  const entry = {
    id: transcriptEntrySeq++,
    text: text.trim(),
    utterances,
    excluded: false
  };
  transcriptBuffer.push(entry);
  const wordCount = getTranscriptWordCount(false);
  win.webContents.send('transcript-chunk', {
    id: entry.id,
    text: entry.text,
    utterances,
    excluded: false,
    wordCount
  });
  emitTranscriptMeta();
}

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 920,
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

function hideRegionIndicator() {
  if (regionIndicatorWin && !regionIndicatorWin.isDestroyed()) {
    regionIndicatorWin.close();
  }
  regionIndicatorWin = null;
}

function showRegionIndicator(region) {
  if (!region || !region.width || !region.height) {
    hideRegionIndicator();
    return;
  }

  hideRegionIndicator();

  regionIndicatorWin = new BrowserWindow({
    x: Math.round(region.x),
    y: Math.round(region.y),
    width: Math.round(region.width),
    height: Math.round(region.height),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  regionIndicatorWin.setAlwaysOnTop(true, 'screen-saver');
  regionIndicatorWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  regionIndicatorWin.setIgnoreMouseEvents(true);
  regionIndicatorWin.loadFile(path.join(__dirname, 'ui', 'region-indicator.html'));
  regionIndicatorWin.on('closed', () => { regionIndicatorWin = null; });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runPipeline(text, utterances = null) {
  const { minWords } = getSettings();
  const words = text.trim().split(/\s+/).length;
  if (!text.trim() || words < minWords) return;

  win.webContents.send('new-result', { text, utterances, result: null });

  try {
    win.webContents.send('status', 'Analyzing: ' + text.slice(0, 40));
    const result = await analyze(text, getResume(), getSettings().answerStyle);
    addToSession({ text, utterances, result });
    win.webContents.send('new-result', { text, utterances, result });
    win.webContents.send('status', 'Listening...');
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[claude error]', detail);
    win.webContents.send('status', 'Claude error: ' + detail.slice(0, 60));
    win.webContents.send('new-result', { text, utterances, result: { _error: detail } });
  }
}

async function runDiarizePipeline(buffer) {
  const { mySpeaker } = getSettings();
  let utterances;
  try {
    win.webContents.send('status', 'Detecting speakers...');
    utterances = await transcribeWithSpeakers(buffer);
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    win.webContents.send('status', 'AssemblyAI error: ' + detail.slice(0, 60));
    return;
  }

  // Filter out user's own speech, keep interviewer questions
  const interviewerText = utterances
    .filter(u => u.speaker !== mySpeaker)
    .map(u => u.text)
    .join(' ');

  pushTranscript(interviewerText || utterances.map(u => u.text).join(' '), utterances);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-devices', () => listDevices());

// Window controls
ipcMain.handle('win-minimize', () => win.minimize());
ipcMain.handle('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.handle('win-hide',     () => win.hide());

ipcMain.handle('set-resume', (_, text) => setResume(text));

// Start audio capture → Whisper → Claude pipeline
ipcMain.handle('start-capture', async (_, deviceId) => {
  if (captureStream) return;

  const { chunkCount } = getSettings();
  win.webContents.send('status', 'Listening...');

  captureStream = startCapture(deviceId, chunkCount, async (chunk) => {
    if (isPaused) return;
    if (getSettings().diarize) {
      await runDiarizePipeline(chunk);
      return;
    }
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
    pushTranscript(text);
  });
});

ipcMain.handle('stop-capture', () => {
  if (captureStream) {
    captureStream.quit();
    captureStream = null;
    isPaused = false;
    transcriptBuffer = [];
    emitTranscriptMeta();
    win.webContents.send('transcript-cleared');
    win.webContents.send('status', 'Stopped.');
  }
});

ipcMain.handle('toggle-pause', () => {
  isPaused = !isPaused;
  win.webContents.send('status', isPaused ? 'Paused.' : 'Listening...');
  return isPaused;
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

ipcMain.handle('get-screen-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 200, height: 120 }
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }));
});

ipcMain.handle('submit-audio-chunk', async (_, arrayBuffer) => {
  const buf = Buffer.from(arrayBuffer);
  if (getSettings().diarize) {
    await runDiarizePipeline(buf);
    return;
  }
  let text;
  try {
    win.webContents.send('status', 'Transcribing...');
    text = await transcribeWebm(buf);
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    win.webContents.send('status', 'Whisper error: ' + detail.slice(0, 60));
    return;
  }
  pushTranscript(text);
});

ipcMain.handle('set-my-speaker', (_, label) => {
  updateSettings({ mySpeaker: label });
});

// Drain buffer → Claude (triggered manually by user)
ipcMain.handle('analyze-now', async () => {
  if (!transcriptBuffer.length) {
    win.webContents.send('status', 'Nothing captured yet.');
    return;
  }
  const includedEntries = transcriptBuffer.filter((e) => !e.excluded);
  if (!includedEntries.length) {
    win.webContents.send('status', 'No active cards selected for Suggest.');
    return;
  }
  const text       = includedEntries.map(e => e.text).join(' ');
  const utterances = includedEntries.flatMap(e => e.utterances || []);
  transcriptBuffer = [];
  emitTranscriptMeta();
  win.webContents.send('transcript-cleared');
  await runPipeline(text, utterances.length ? utterances : null);
});

ipcMain.handle('clear-transcript', () => {
  transcriptBuffer = [];
  emitTranscriptMeta();
  win.webContents.send('transcript-cleared');
});

ipcMain.handle('remove-transcript-entry', (_, entryId) => {
  const id = Number(entryId);
  if (!Number.isFinite(id)) return { ok: false, wordCount: getTranscriptWordCount(false) };

  const before = transcriptBuffer.length;
  transcriptBuffer = transcriptBuffer.filter((e) => e.id !== id);
  const removed = transcriptBuffer.length !== before;

  emitTranscriptMeta();
  return { ok: removed, wordCount: getTranscriptWordCount(false) };
});

ipcMain.handle('set-transcript-entry-excluded', (_, entryId, excluded) => {
  const id = Number(entryId);
  if (!Number.isFinite(id)) {
    return { ok: false, excluded: false, wordCount: getTranscriptWordCount(false) };
  }

  const entry = transcriptBuffer.find((e) => e.id === id);
  if (!entry) {
    return { ok: false, excluded: false, wordCount: getTranscriptWordCount(false) };
  }

  entry.excluded = Boolean(excluded);
  emitTranscriptMeta();
  return { ok: true, excluded: entry.excluded, wordCount: getTranscriptWordCount(false) };
});

// ── CC Region selection ───────────────────────────────────────────────────────
ipcMain.handle('select-cc-region', () => {
  hideRegionIndicator();
  if (regionWin) { regionWin.close(); regionWin = null; }
  const { bounds } = electronScreen.getPrimaryDisplay();
  regionWin = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, movable: false, skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  regionWin.loadFile(path.join(__dirname, 'ui', 'region-select.html'));
});

ipcMain.on('region-selected', (_, region) => {
  ccRegion = region;
  showRegionIndicator(region);
  if (regionWin) { regionWin.close(); regionWin = null; }
  win.webContents.send('region-confirmed', region);
  win.webContents.send('status', `🎯 Region set: ${region.width}×${region.height} — ready`);
});

ipcMain.on('region-cancelled', () => {
  if (regionWin) { regionWin.close(); regionWin = null; }
  win.webContents.send('status', 'Region selection cancelled.');
});

ipcMain.handle('get-cc-region',   () => ccRegion);
ipcMain.handle('clear-cc-region', () => {
  ccRegion = null;
  hideRegionIndicator();
  win.webContents.send('region-confirmed', null);
});

ipcMain.handle('translate-text', async (_, text) => {
  const src = normalizeCcText(text);
  if (!src) return { vi: '', en: '' };

  const key = src.slice(0, 800);
  if (translateCache.has(key)) return translateCache.get(key);

  try {
    const translated = await translateBilingual(src);
    translateCache.set(key, translated);
    if (translateCache.size > 200) {
      const oldest = translateCache.keys().next().value;
      translateCache.delete(oldest);
    }
    return translated;
  } catch (_) {
    return { vi: src, en: src };
  }
});

// ── Screen CC mode (screenshot + Vision OCR) ─────────────────────────────────
ipcMain.handle('start-screen-cc', async (_, sourceId) => {
  if (screenCCWatcher) { clearInterval(screenCCWatcher); screenCCWatcher = null; }

  let isOcrRunning = false;
  const { width: sw, height: sh } = electronScreen.getPrimaryDisplay().size;

  const runOcrTick = async () => {
    if (isPaused || isOcrRunning) return;
    isOcrRunning = true;
    try {
      let thumbnail;

      if (ccRegion) {
        // Capture full primary screen at native res, then crop to region
        const sources = await desktopCapturer.getSources({
          types: ['screen'], thumbnailSize: { width: sw, height: sh }
        });
        const src = sources[0];
        if (!src) return;
        thumbnail = src.thumbnail.crop({
          x: ccRegion.x, y: ccRegion.y,
          width: ccRegion.width, height: ccRegion.height
        });
      } else {
        // Capture selected window
        const sources = await desktopCapturer.getSources({
          types: ['window', 'screen'], thumbnailSize: { width: 1280, height: 720 }
        });
        const src = sources.find(s => s.id === sourceId);
        if (!src) return;
        thumbnail = src.thumbnail;
      }

      win.webContents.send('status', 'Reading CC...');
      const text = await extractCCText(thumbnail.toDataURL());
      const normalized = normalizeCcText(text);
      if (normalized && normalized !== lastScreenText) {
        win.webContents.send('cc-live-text', { text: normalized, source: 'screen' });
        const delta = extractNewCcDelta(lastScreenText, normalized);
        lastScreenText = normalized;
        if (delta) pushTranscript(delta);
      }
      win.webContents.send('status', ccRegion ? '🎯 Region CC active...' : '📺 Screen CC active...');
    } catch (err) {
      win.webContents.send('status', 'Vision error: ' + err.message.slice(0, 50));
    } finally {
      isOcrRunning = false;
    }
  };

  // Run once immediately so user sees live caption without waiting first interval tick.
  runOcrTick();
  screenCCWatcher = setInterval(runOcrTick, SCREEN_CC_INTERVAL_MS);

  win.webContents.send('status', ccRegion ? '🎯 Region CC active...' : '📺 Screen CC active...');
});

ipcMain.handle('stop-screen-cc', () => {
  if (screenCCWatcher) { clearInterval(screenCCWatcher); screenCCWatcher = null; }
  lastScreenText = '';
  win.webContents.send('cc-live-text', { text: '', source: 'screen' });
  win.webContents.send('status', 'Stopped.');
});

// ── Clipboard CC mode ─────────────────────────────────────────────────────────
ipcMain.handle('start-clipboard-watch', () => {
  if (clipboardWatcher) return;
  lastClipText = normalizeCcText(clipboard.readText());
  clipboardWatcher = setInterval(() => {
    if (isPaused) return;
    const text = normalizeCcText(clipboard.readText());
    if (text && text !== lastClipText) {
      win.webContents.send('cc-live-text', { text, source: 'clipboard' });
      const delta = extractNewCcDelta(lastClipText, text);
      lastClipText = text;
      if (delta && delta.length >= 4) pushTranscript(delta);
    }
  }, 600);
  win.webContents.send('status', '📋 CC mode — watching clipboard...');
});

ipcMain.handle('stop-clipboard-watch', () => {
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher);
    clipboardWatcher = null;
    lastClipText = '';
  }
  win.webContents.send('cc-live-text', { text: '', source: 'clipboard' });
  win.webContents.send('status', 'Stopped.');
});
