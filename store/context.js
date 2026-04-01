const fs   = require('fs');
const path = require('path');

// ── Profile (loaded from profile.json, used as default resume context) ────────
let profile = {};
try {
  const raw = fs.readFileSync(path.join(__dirname, 'profile.json'), 'utf-8');
  profile = JSON.parse(raw);
} catch (_) { /* no profile file — graceful fallback */ }

function getProfile() { return profile; }

// ── Portfolio (loaded from portfolio.json, used for project-level detail) ─────
let portfolio = {};
try {
  const portfolioRaw = fs.readFileSync(path.join(__dirname, 'portfolio.json'), 'utf-8');
  portfolio = JSON.parse(portfolioRaw);
} catch (_) { /* no portfolio file — graceful fallback */ }

function getPortfolio() { return portfolio; }

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
  chunkCount:       5,      // audio chunks before sending to Whisper (~0.5s per chunk)
  minWords:         4,      // skip transcripts shorter than this
  showTranslation: false,   // show EN↔VN translation in cards
  answerStyle:    'spoken', // spoken | technical | star | all
  diarize:        false,    // enable speaker detection (AssemblyAI)
  mySpeaker:      null      // speaker label user identifies as — filtered out from copilot
};

function getSettings()         { return { ...settings }; }
function updateSettings(patch) { Object.assign(settings, patch); }

module.exports = {
  getProfile,
  getPortfolio,
  getResume, setResume,
  addToSession, getSession, clearSession,
  getSettings, updateSettings
};
