// ── Resume ───────────────────────────────────────────────────────────────────
let resume = '';
function getResume()       { return resume; }
function setResume(text)   { resume = text || ''; }

// ── Session history ───────────────────────────────────────────────────────────
let sessionHistory = [];

function addToSession(entry) {
  sessionHistory.push({ ...entry, timestamp: new Date().toISOString() });
}

function getSession()  { return sessionHistory; }
function clearSession(){ sessionHistory = []; }

// ── Settings ──────────────────────────────────────────────────────────────────
let settings = {
  chunkCount:      10,   // audio chunks before sending to Whisper (~1s per chunk)
  minWords:         4,   // skip transcripts shorter than this
  showTranslation: true  // show EN↔VN translation in cards
};

function getSettings()         { return { ...settings }; }
function updateSettings(patch) { Object.assign(settings, patch); }

module.exports = {
  getResume, setResume,
  addToSession, getSession, clearSession,
  getSettings, updateSettings
};
