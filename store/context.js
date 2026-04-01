const fs   = require('fs');
const path = require('path');

// ── Profile (loaded from profile.json, used as default resume context) ────────
let profile = {};
try {
  const raw = fs.readFileSync(path.join(__dirname, 'profile.json'), 'utf-8');
  profile = JSON.parse(raw);
} catch (_) { /* no profile file — graceful fallback */ }

function getProfile() { return profile; }

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
  chunkCount:      10,      // audio chunks before sending to Whisper (~1s per chunk)
  minWords:         4,      // skip transcripts shorter than this
  showTranslation: true,    // show EN↔VN translation in cards
  answerStyle:    'spoken', // spoken | technical | star | all
  diarize:        false,    // enable speaker detection (AssemblyAI)
  mySpeaker:      null      // speaker label user identifies as — filtered out from copilot
};

function getSettings()         { return { ...settings }; }
function updateSettings(patch) { Object.assign(settings, patch); }

module.exports = {
  getProfile,
  getResume, setResume,
  addToSession, getSession, clearSession,
  getSettings, updateSettings
};
