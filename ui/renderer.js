const deviceSelect  = document.getElementById('device-select');
const startBtn      = document.getElementById('start-btn');
const stopBtn       = document.getElementById('stop-btn');
const statusBar     = document.getElementById('status-bar');
const results       = document.getElementById('results');
const closeBtn      = document.getElementById('close-btn');
const saveBtn       = document.getElementById('save-btn');
const settingsBtn   = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const manualToggle  = document.getElementById('manual-toggle');
const manualPanel   = document.getElementById('manual-panel');
const manualText    = document.getElementById('manual-text');
const manualAsk     = document.getElementById('manual-ask');
const resumeToggle  = document.getElementById('resume-toggle');
const resumePanel   = document.getElementById('resume-panel');
const resumeText    = document.getElementById('resume-text');
const resumeSave    = document.getElementById('resume-save');

// ── Boot ──────────────────────────────────────────────────────────────────────

// Load devices
window.copilot.getDevices().then(devices => {
  deviceSelect.innerHTML = '';
  if (!devices.length) {
    deviceSelect.innerHTML = '<option value="">No input devices found</option>';
    startBtn.disabled = true;
    return;
  }
  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (/stereo mix|cable output/i.test(d.name)) opt.selected = true;
    deviceSelect.appendChild(opt);
  });
});

// Load saved settings
window.copilot.getSettings().then(s => {
  document.getElementById('setting-chunks').value      = String(s.chunkCount);
  document.getElementById('setting-minwords').value    = String(s.minWords);
  document.getElementById('setting-translation').checked = s.showTranslation;
});

// ── Audio controls ────────────────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  const id = parseInt(deviceSelect.value, 10);
  await window.copilot.startCapture(id);
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-block';
  clearResults();
});

stopBtn.addEventListener('click', async () => {
  await window.copilot.stopCapture();
  startBtn.style.display = 'inline-block';
  stopBtn.style.display  = 'none';
});

closeBtn.addEventListener('click', () => window.close());

// ── Save session ──────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const res = await window.copilot.saveSession();
  if (res.ok) {
    statusBar.textContent = 'Saved: ' + res.file.split('\\').pop();
  } else {
    statusBar.textContent = res.msg;
  }
});

// ── Settings panel ────────────────────────────────────────────────────────────

settingsBtn.addEventListener('click', () => {
  const open = settingsPanel.style.display === 'block';
  settingsPanel.style.display = open ? 'none' : 'block';
});

document.getElementById('setting-chunks').addEventListener('change', e => {
  window.copilot.updateSettings({ chunkCount: parseInt(e.target.value) });
});

document.getElementById('setting-minwords').addEventListener('change', e => {
  window.copilot.updateSettings({ minWords: parseInt(e.target.value) });
});

document.getElementById('setting-translation').addEventListener('change', e => {
  window.copilot.updateSettings({ showTranslation: e.target.checked });
  document.querySelectorAll('.translation').forEach(el => {
    el.style.display = e.target.checked ? '' : 'none';
  });
});

// ── Manual ask ────────────────────────────────────────────────────────────────

manualToggle.addEventListener('click', () => {
  const open = manualPanel.style.display === 'block';
  manualPanel.style.display = open ? 'none' : 'block';
  manualToggle.textContent  = open ? '▾ Ask a Question' : '▴ Ask a Question';
});

manualAsk.addEventListener('click', async () => {
  const text = manualText.value.trim();
  if (!text) return;
  statusBar.textContent = 'Asking...';
  await window.copilot.askManual(text);
  manualText.value = '';
});

// Also send on Ctrl+Enter
manualText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) manualAsk.click();
});

// ── Resume panel ──────────────────────────────────────────────────────────────

resumeToggle.addEventListener('click', () => {
  const open = resumePanel.style.display === 'block';
  resumePanel.style.display = open ? 'none' : 'block';
  resumeToggle.textContent  = open ? '▾ Resume / Background' : '▴ Resume / Background';
});

resumeSave.addEventListener('click', () => {
  window.copilot.setResume(resumeText.value);
  resumePanel.style.display = 'none';
  resumeToggle.textContent  = '▾ Resume / Background';
  statusBar.textContent = 'Resume saved.';
});

// ── Status updates ────────────────────────────────────────────────────────────

window.copilot.onStatus(msg => {
  statusBar.textContent = msg;
});

// ── Results rendering ─────────────────────────────────────────────────────────

const cardMap = new Map();

function clearResults() {
  results.innerHTML = '';
  cardMap.clear();
}

function showTranslation() {
  const el = document.getElementById('setting-translation');
  return el ? el.checked : true;
}

window.copilot.onResult(({ text, result }) => {
  // Remove empty hint on first result
  const hint = results.querySelector('.empty-hint');
  if (hint) hint.remove();

  let card = cardMap.get(text);
  if (!card) {
    card = document.createElement('div');
    card.className = 'result-card';
    cardMap.set(text, card);
    results.insertBefore(card, results.firstChild);
    if (cardMap.size > 20) cardMap.delete(cardMap.keys().next().value);
  }

  if (!result) {
    card.innerHTML = `<div class="transcript">"${text}"</div><div class="translation" style="color:#64748b;font-style:italic">Analyzing...</div>`;
    return;
  }

  const diffClass    = `difficulty-${result.difficulty || 'medium'}`;
  const showTrans    = showTranslation();

  const suggestionsHtml = (result.suggestions || []).map(s => `
    <div class="suggestion">
      <div class="suggestion-header">
        <span class="suggestion-label">${s.label}</span>
        <div class="tags">${(s.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
      <div class="suggestion-body">${s.answer}</div>
    </div>
  `).join('');

  const keywordsHtml = (result.keywords || []).map(k => `<span class="keyword">${k}</span>`).join('');

  card.innerHTML = `
    <div class="transcript">"${text}"</div>
    <div class="translation" style="display:${showTrans ? '' : 'none'}">${result.translation || ''}</div>
    <div class="suggestions-title">Suggested Answers</div>
    ${suggestionsHtml}
    <div class="meta-row">
      ${keywordsHtml}
      <span class="difficulty-badge ${diffClass}">${result.difficulty || 'medium'}</span>
    </div>
  `;
});
