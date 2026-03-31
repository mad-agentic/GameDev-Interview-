const deviceSelect = document.getElementById('device-select');
const startBtn     = document.getElementById('start-btn');
const stopBtn      = document.getElementById('stop-btn');
const statusBar    = document.getElementById('status-bar');
const results      = document.getElementById('results');
const closeBtn     = document.getElementById('close-btn');
const resumeToggle = document.getElementById('resume-toggle');
const resumePanel  = document.getElementById('resume-panel');
const resumeText   = document.getElementById('resume-text');
const resumeSave   = document.getElementById('resume-save');

// --- Boot: load devices ---
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
    // Pre-select Stereo Mix / VB-Cable if found
    if (/stereo mix|cable output/i.test(d.name)) opt.selected = true;
    deviceSelect.appendChild(opt);
  });
});

// --- Controls ---
startBtn.addEventListener('click', async () => {
  const id = parseInt(deviceSelect.value, 10);
  await window.copilot.startCapture(id);
  startBtn.style.display = 'none';
  stopBtn.style.display  = 'inline-block';
  results.innerHTML = '';
});

stopBtn.addEventListener('click', async () => {
  await window.copilot.stopCapture();
  startBtn.style.display = 'inline-block';
  stopBtn.style.display  = 'none';
});

closeBtn.addEventListener('click', () => window.close());

// --- Resume panel ---
resumeToggle.addEventListener('click', () => {
  const open = resumePanel.style.display === 'block';
  resumePanel.style.display = open ? 'none' : 'block';
  resumeToggle.textContent  = open ? '▾ Resume / Background' : '▴ Resume / Background';
});

resumeSave.addEventListener('click', () => {
  window.copilot.setResume(resumeText.value);
  resumePanel.style.display = 'none';
  resumeToggle.textContent  = '▾ Resume / Background';
});

// --- Status updates ---
window.copilot.onStatus(msg => {
  statusBar.textContent = msg;
});

// --- New result ---
// Keyed by text so we can upgrade a transcript-only card to a full card
const cardMap = new Map();

window.copilot.onResult(({ text, result }) => {
  // If a card for this text already exists, replace it
  let card = cardMap.get(text);
  if (!card) {
    card = document.createElement('div');
    card.className = 'result-card';
    cardMap.set(text, card);
    results.insertBefore(card, results.firstChild);
    // Keep map small
    if (cardMap.size > 20) cardMap.delete(cardMap.keys().next().value);
  }

  if (!result) {
    // Transcript only — Claude not ready yet
    card.innerHTML = `<div class="transcript">"${text}"</div><div class="translation" style="color:#64748b;font-style:italic">Analyzing...</div>`;
    return;
  }

  const diffClass = `difficulty-${result.difficulty || 'medium'}`;

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
    <div class="translation">${result.translation || ''}</div>
    <div class="suggestions-title">Suggested Answers</div>
    ${suggestionsHtml}
    <div class="meta-row">
      ${keywordsHtml}
      <span class="difficulty-badge ${diffClass}">${result.difficulty || 'medium'}</span>
    </div>
  `;
});
