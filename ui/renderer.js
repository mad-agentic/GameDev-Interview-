const deviceSelect      = document.getElementById('device-select');
const startBtn          = document.getElementById('start-btn');
const pauseBtn          = document.getElementById('pause-btn');
const stopBtn           = document.getElementById('stop-btn');
const statusBar         = document.getElementById('status-bar');
const analyzeBtn        = document.getElementById('analyze-btn');
const clearTxBtn        = document.getElementById('clear-transcript-btn');
const ccBtn             = document.getElementById('cc-btn');
const regionBtn         = document.getElementById('region-btn');
const regionBadge       = document.getElementById('region-badge');
const leftWordCount     = document.getElementById('left-word-count');
const transcriptResults = document.getElementById('transcript-results');
const suggestionResults = document.getElementById('suggestion-results');
const reverseAskList   = document.getElementById('reverse-ask-list');
const transcriptTranslateCache = new Map();
let liveCcCard = null;

let screenSourceId  = null;
let screenRecorder  = null;
let isPausedLocally = false;
const closeBtn      = document.getElementById('close-btn');
const saveBtn       = document.getElementById('save-btn');
const settingsBtn   = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const manualText    = document.getElementById('manual-text');
const manualAsk     = document.getElementById('manual-ask');
const resumeToggle  = document.getElementById('resume-toggle');
const resumePanel   = document.getElementById('resume-panel');
const resumeText    = document.getElementById('resume-text');
const resumeSave    = document.getElementById('resume-save');
const mainArea      = document.getElementById('main-area');
const leftPanel     = document.getElementById('left-panel');
const panelDivider  = document.getElementById('panel-divider');

const PANEL_WIDTH_KEY = 'gamedev.leftPanelWidth';

function clampLeftPanelWidth(width) {
  const totalWidth = mainArea?.clientWidth || window.innerWidth || 780;
  const minLeft = 220;
  const maxLeft = Math.max(320, totalWidth - 280);
  return Math.min(maxLeft, Math.max(minLeft, width));
}

function applyLeftPanelWidth(width, persist = true) {
  const clamped = clampLeftPanelWidth(width);
  leftPanel.style.width = `${clamped}px`;
  if (persist) localStorage.setItem(PANEL_WIDTH_KEY, String(clamped));
}

function initPanelDivider() {
  if (!mainArea || !leftPanel || !panelDivider) return;

  const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
  if (Number.isFinite(saved) && saved > 0) {
    applyLeftPanelWidth(saved, false);
  }

  let pointerId = null;

  panelDivider.addEventListener('pointerdown', (e) => {
    pointerId = e.pointerId;
    panelDivider.classList.add('dragging');
    document.body.classList.add('is-resizing-panels');
    panelDivider.setPointerCapture(pointerId);
    e.preventDefault();
  });

  panelDivider.addEventListener('pointermove', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const mainRect = mainArea.getBoundingClientRect();
    const nextWidth = e.clientX - mainRect.left;
    applyLeftPanelWidth(nextWidth, true);
  });

  const stopDragging = (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    panelDivider.classList.remove('dragging');
    document.body.classList.remove('is-resizing-panels');
    try { panelDivider.releasePointerCapture(pointerId); } catch (_) { /* no-op */ }
    pointerId = null;
  };

  panelDivider.addEventListener('pointerup', stopDragging);
  panelDivider.addEventListener('pointercancel', stopDragging);

  window.addEventListener('resize', () => {
    const current = Number.parseFloat(leftPanel.style.width) || leftPanel.offsetWidth;
    applyLeftPanelWidth(current, true);
  });
}

initPanelDivider();

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
  document.getElementById('setting-chunks').value         = String(s.chunkCount);
  document.getElementById('setting-minwords').value       = String(s.minWords);
  document.getElementById('setting-translation').checked  = s.showTranslation;
  document.getElementById('setting-answerstyle').value    = s.answerStyle || 'spoken';
  document.getElementById('setting-diarize').checked      = s.diarize || false;
});

// ── Screen source picker ──────────────────────────────────────────────────────

const screenSourceBtn = document.getElementById('screen-source-btn');
const sourcePanel     = document.getElementById('source-panel');
const sourceGrid      = document.getElementById('source-grid');
const sourceSearch    = document.getElementById('source-search');

screenSourceBtn.addEventListener('click', async () => {
  const open = sourcePanel.style.display === 'block';
  if (open) { sourcePanel.style.display = 'none'; return; }

  sourceGrid.innerHTML = '<div class="source-loading">Loading...</div>';
  sourcePanel.style.display = 'block';

  const sources = await window.copilot.getScreenSources();
  renderSources(sources);

  sourceSearch.oninput = () => {
    const q = sourceSearch.value.toLowerCase();
    renderSources(sources.filter(s => s.name.toLowerCase().includes(q)));
  };
});

function renderSources(sources) {
  sourceGrid.innerHTML = sources.map(s => `
    <div class="source-item ${s.id === screenSourceId ? 'active' : ''}" data-id="${s.id}" data-name="${s.name}">
      <img src="${s.thumbnail}" alt="" />
      <span>${s.name}</span>
    </div>
  `).join('');

  sourceGrid.querySelectorAll('.source-item').forEach(el => {
    el.addEventListener('click', () => {
      screenSourceId = el.dataset.id;
      screenSourceBtn.title = el.dataset.name;
      screenSourceBtn.classList.add('active-source');
      sourcePanel.style.display = 'none';
      statusBar.textContent = 'Source: ' + el.dataset.name.slice(0, 40);
    });
  });
}

// ── Audio controls ────────────────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  if (screenSourceId) {
    await startScreenCapture();
  } else {
    const id = parseInt(deviceSelect.value, 10);
    await window.copilot.startCapture(id);
  }
  startBtn.style.display = 'none';
  pauseBtn.style.display = 'inline-block';
  stopBtn.style.display  = 'inline-block';
  clearResults();
});

pauseBtn.addEventListener('click', async () => {
  if (screenRecorder) {
    isPausedLocally = !isPausedLocally;
    const paused = isPausedLocally;
    statusBar.textContent = paused ? 'Paused.' : 'Listening (screen)...';
    pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    pauseBtn.classList.toggle('paused', paused);
  } else {
    const paused = await window.copilot.togglePause();
    pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
    pauseBtn.classList.toggle('paused', paused);
  }
});

stopBtn.addEventListener('click', async () => {
  if (screenRecorder) {
    screenRecorder.stop();
    screenRecorder.stream?.getTracks().forEach(t => t.stop());
    screenRecorder = null;
  } else {
    await window.copilot.stopCapture();
  }
  startBtn.style.display = 'inline-block';
  pauseBtn.style.display = 'none';
  pauseBtn.textContent   = '⏸ Pause';
  pauseBtn.classList.remove('paused');
  stopBtn.style.display  = 'none';
});

async function startScreenCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screenSourceId } },
    video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screenSourceId, maxWidth: 1, maxHeight: 1 } }
  });

  const audioStream = new MediaStream(stream.getAudioTracks());
  stream.getVideoTracks().forEach(t => t.stop());

  const { chunkCount } = await window.copilot.getSettings();
  const timeslice = chunkCount * 100;

  screenRecorder = new MediaRecorder(audioStream);
  screenRecorder.ondataavailable = async (e) => {
    if (e.data.size > 0 && !isPausedLocally) {
      const buf = await e.data.arrayBuffer();
      await window.copilot.submitAudioChunk(buf);
    }
  };
  screenRecorder.start(timeslice);
  statusBar.textContent = 'Listening (screen)...';
}

closeBtn.addEventListener('click', () => window.close());
document.getElementById('hide-btn').addEventListener('click',     () => window.copilot.winHide());
document.getElementById('minimize-btn').addEventListener('click', () => window.copilot.winMinimize());
document.getElementById('maximize-btn').addEventListener('click', async () => {
  await window.copilot.winMaximize();
  const btn = document.getElementById('maximize-btn');
  btn.title = btn.title === 'Fullsize / Restore' ? 'Thu nhỏ cửa sổ' : 'Fullsize / Restore';
});

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

document.getElementById('setting-answerstyle').addEventListener('change', e => {
  window.copilot.updateSettings({ answerStyle: e.target.value });
});

document.getElementById('setting-diarize').addEventListener('change', e => {
  window.copilot.updateSettings({ diarize: e.target.checked });
});

document.getElementById('setting-translation').addEventListener('change', e => {
  window.copilot.updateSettings({ showTranslation: e.target.checked });
  document.querySelectorAll('.translation').forEach(el => {
    el.style.display = e.target.checked ? '' : 'none';
  });
});

// ── Manual ask ────────────────────────────────────────────────────────────────

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
  transcriptResults.innerHTML = '<div class="empty-hint">Transcript sẽ hiện ở đây.<br/>Bấm <strong>Start</strong> hoặc bật <strong>CC</strong>.</div>';
  suggestionResults.innerHTML = '<div class="empty-hint">Bấm <strong>✨ Suggest</strong><br/>để nhận gợi ý trả lời AI.</div>';
  if (reverseAskList) {
    reverseAskList.innerHTML = '<div class="reverse-empty">Sau khi bấm Suggest, câu hỏi hỏi ngược sẽ hiện ở đây.</div>';
  }
  cardMap.clear();
}

function uniqueQuestions(list = []) {
  const out = [];
  const seen = new Set();
  for (const q of list) {
    const item = typeof q === 'string'
      ? { en: String(q || '').trim(), vi: String(q || '').trim() }
      : {
          en: String(q?.en || '').trim(),
          vi: String(q?.vi || '').trim()
        };

    if (!item.en && !item.vi) continue;
    if (!item.en) item.en = item.vi;
    if (!item.vi) item.vi = item.en;

    const key = `${item.en.toLowerCase()}|${item.vi.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractQuestionFromAnswer(answer = '') {
  const text = String(answer || '').trim();
  if (!text) return null;
  const questions = text.match(/[^?.!\n]*\?/g);
  if (!questions || !questions.length) return null;
  const last = questions[questions.length - 1].trim();
  return last || null;
}

function buildFallbackReverseQuestions(result) {
  const fromAnswers = (result?.suggestions || []).map((s) => ({
    en: extractQuestionFromAnswer(s?.answer_en || s?.answer || ''),
    vi: extractQuestionFromAnswer(s?.answer_vi || s?.answer || '')
  })).filter((q) => q.en || q.vi);

  const defaults = [
    {
      en: 'Would you like me to go deeper into technical details or leadership impact?',
      vi: 'Anh/chị muốn tôi đào sâu hơn về kỹ thuật hay tác động ở góc độ leadership?'
    },
    {
      en: 'Did you get a chance to review my portfolio with project metrics?',
      vi: 'Anh/chị đã có dịp xem portfolio của tôi với các số liệu dự án chưa?'
    },
    {
      en: 'Which part matters most for this role: optimization, architecture, or team collaboration?',
      vi: 'Với vị trí này, phần nào quan trọng nhất: optimization, architecture hay team collaboration?'
    }
  ];

  return uniqueQuestions([...fromAnswers, ...defaults]).slice(0, 5);
}

function renderReverseAskBoard(result) {
  if (!reverseAskList) return;
  const modelQuestions = Array.isArray(result?.reverse_questions) ? result.reverse_questions : [];
  const normalized = uniqueQuestions(modelQuestions);
  const questions = normalized.length
    ? normalized.slice(0, 5)
    : buildFallbackReverseQuestions(result);

  if (!questions.length) {
    reverseAskList.innerHTML = '<div class="reverse-empty">Chưa có gợi ý câu hỏi hỏi ngược cho nội dung này.</div>';
    return;
  }

  reverseAskList.innerHTML = questions.map((q, i) => `
    <div class="reverse-item">
      <div class="reverse-row"><span class="reverse-index">Q${i + 1} EN.</span>${escapeHtml(q.en)}</div>
      <div class="reverse-row reverse-vi"><span class="reverse-index">Q${i + 1} VI.</span>${escapeHtml(q.vi)}</div>
    </div>
  `).join('');
}

function showTranslation() {
  const el = document.getElementById('setting-translation');
  return el ? el.checked : true;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTranscriptLines(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return '';

  // Add line breaks before common speaker markers.
  text = text.replace(/\s+(?=(John\sM\.|Speaker\s*\d+|Interviewer|Candidate)\b)/gi, '\n');

  // Add line breaks at sentence boundaries for long CC chunks.
  text = text.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n');

  text = text.replace(/\n{2,}/g, '\n').trim();
  return text;
}

function renderTranscriptHtml(rawText) {
  const lines = formatTranscriptLines(rawText)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  return lines.map(line => `<div>${escapeHtml(line)}</div>`).join('');
}

function enableAutoTranslationIfNeeded() {
  const toggle = document.getElementById('setting-translation');
  if (!toggle || toggle.checked) return;
  toggle.checked = true;
  window.copilot.updateSettings({ showTranslation: true });
  document.querySelectorAll('.translation').forEach(el => {
    el.style.display = '';
  });
}

function translateCard(card, sourceText, lang = 'vi', ensureEnabled = false) {
  const text = String(sourceText || '').trim();
  if (!text) return;
  if (ensureEnabled) enableAutoTranslationIfNeeded();

  let translatedBox = card.querySelector('.translation');
  if (!translatedBox) {
    translatedBox = document.createElement('div');
    translatedBox.className = 'translation';
    card.appendChild(translatedBox);
  }
  translatedBox.style.display = '';
  translatedBox.textContent = lang === 'en' ? 'Translating...' : 'Đang dịch...';

  const cached = transcriptTranslateCache.get(text);
  if (cached) {
    translatedBox.textContent = lang === 'en'
      ? (cached.en || cached.vi || text)
      : (cached.vi || cached.en || text);
    return;
  }

  window.copilot.translateText(text).then((translated) => {
    transcriptTranslateCache.set(text, translated || { vi: text, en: text });
    if (transcriptTranslateCache.size > 120) {
      const oldest = transcriptTranslateCache.keys().next().value;
      transcriptTranslateCache.delete(oldest);
    }
    if (!card.isConnected) return;
    translatedBox.textContent = lang === 'en'
      ? (translated?.en || translated?.vi || text)
      : (translated?.vi || translated?.en || text);
  }).catch(() => {
    if (!card.isConnected) return;
    translatedBox.textContent = text;
  });
}

function ensureLiveCcCard() {
  if (liveCcCard && liveCcCard.isConnected) return liveCcCard;

  const hint = transcriptResults.querySelector('.empty-hint');
  if (hint) hint.remove();

  liveCcCard = document.createElement('div');
  liveCcCard.className = 'tx-card';
  liveCcCard.dataset.live = 'true';
  transcriptResults.insertBefore(liveCcCard, transcriptResults.firstChild);
  return liveCcCard;
}

function clearLiveCcCard() {
  if (liveCcCard) liveCcCard.remove();
  liveCcCard = null;
}

function renderLiveCc(text) {
  const card = ensureLiveCcCard();
  card.innerHTML = `
    <div class="tx-topbar">
      <div class="suggestions-title">Live CC</div>
      <div class="tx-sub-actions">
        <button class="tx-sub-btn" type="button" data-lang="vi">Sub VN</button>
        <button class="tx-sub-btn" type="button" data-lang="en">Sub EN</button>
      </div>
    </div>
    <div class="transcript">${renderTranscriptHtml(text)}</div>
  `;

  card.querySelectorAll('.tx-sub-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      translateCard(card, text, btn.dataset.lang || 'vi', true);
    });
  });

  if (showTranslation()) translateCard(card, text, 'vi', false);
}

function buildUtterancesHtml(utterances) {
  if (!utterances || !utterances.length) return null;
  let mySpeaker = null;
  window.copilot.getSettings().then(s => { mySpeaker = s.mySpeaker; });

  return `<div class="utterances">${utterances.map(u => `
    <div class="utterance speaker-${u.speaker.toLowerCase()}">
      <span class="speaker-badge" data-speaker="${u.speaker}"
            title="Click để đánh dấu đây là tôi"
            onclick="markMySpeaker('${u.speaker}', this)">
        ${u.speaker}
      </span>
      <span class="utterance-text">${u.text}</span>
    </div>
  `).join('')}</div>`;
}

window._mySpeaker = null;
function markMySpeaker(label, el) {
  window._mySpeaker = window._mySpeaker === label ? null : label;
  window.copilot.setMySpeaker(window._mySpeaker);

  document.querySelectorAll('.speaker-badge').forEach(b => {
    b.classList.toggle('my-speaker', b.dataset.speaker === window._mySpeaker);
  });
  document.querySelectorAll(`.utterance`).forEach(u => {
    const sp = u.querySelector('.speaker-badge')?.dataset.speaker;
    u.classList.toggle('muted', sp === window._mySpeaker);
  });
}

// ── Transcript cards (auto-appear per chunk) ──────────────────────────────────

const txCardMap = new Map();

window.copilot.onTranscriptChunk(({ text, utterances, wordCount }) => {
  // Update word count in left panel header
  leftWordCount.textContent = wordCount + 'w';
  analyzeBtn.textContent = `✨ Suggest (${wordCount}w)`;

  // Create a simple transcript card in left panel
  const hint = transcriptResults.querySelector('.empty-hint');
  if (hint) hint.remove();

  const card = document.createElement('div');
  card.className = 'tx-card';
  const utterHtml = buildUtterancesHtml(utterances);
  card.innerHTML = utterHtml || `
    <div class="tx-topbar">
      <span class="suggestions-title">CC</span>
      <div class="tx-sub-actions">
        <button class="tx-sub-btn" type="button" data-lang="vi">Sub VN</button>
        <button class="tx-sub-btn" type="button" data-lang="en">Sub EN</button>
      </div>
    </div>
    <div class="transcript tx-editable" title="Click để sửa" data-raw="${escapeHtml(text)}">${renderTranscriptHtml(text)}</div>`;

  card.querySelectorAll('.tx-sub-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      translateCard(card, text, btn.dataset.lang || 'vi', true);
    });
  });

  if (!utterHtml && ccActive && showTranslation()) {
    translateCard(card, text.trim(), 'vi', false);
  }

  // Click-to-edit on plain transcript text
  card.querySelector('.tx-editable')?.addEventListener('click', function() {
    const current = this.dataset.raw || this.textContent;
    const input = document.createElement('input');
    input.className = 'tx-edit-input';
    input.value = current;
    this.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      const div = document.createElement('div');
      div.className = 'transcript tx-editable';
      div.title = 'Click để sửa';
      div.dataset.raw = input.value;
      div.innerHTML = renderTranscriptHtml(input.value);
      div.addEventListener('click', arguments.callee); // re-attach
      input.replaceWith(div);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = current; input.blur(); }
    });
  });

  transcriptResults.insertBefore(card, transcriptResults.firstChild);

  txCardMap.set(Date.now(), card);
  if (txCardMap.size > 40) {
    const oldest = txCardMap.keys().next().value;
    txCardMap.get(oldest)?.remove();
    txCardMap.delete(oldest);
  }
});

window.copilot.onTranscriptCleared(() => {
  leftWordCount.textContent = '';
  analyzeBtn.textContent = '✨ Suggest';
  clearLiveCcCard();
  // Dim existing tx-cards to signal they've been consumed
  document.querySelectorAll('.tx-card').forEach(c => c.classList.add('consumed'));
});

window.copilot.onCcLiveText(({ text }) => {
  const liveText = String(text || '').trim();
  if (!liveText) {
    clearLiveCcCard();
    return;
  }
  renderLiveCc(liveText);
});

analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = '⏳...';
  await window.copilot.analyzeNow();
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = '✨ Suggest';
});

clearTxBtn.addEventListener('click', () => window.copilot.clearTranscript());

// ── CC Mode (screen Vision OCR → fallback clipboard) ─────────────────────────
let ccActive = false;

ccBtn.addEventListener('click', async () => {
  ccActive = !ccActive;

  if (ccActive) {
    // Stop audio capture if running
    if (stopBtn.style.display === 'inline-block') {
      if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder.stream?.getTracks().forEach(t => t.stop());
        screenRecorder = null;
      } else {
        await window.copilot.stopCapture();
      }
      startBtn.style.display = 'inline-block';
      pauseBtn.style.display = 'none';
      stopBtn.style.display  = 'none';
    }

    if (screenSourceId || currentRegion) {
      // Has screen source OR region selected → Vision OCR mode
      // (khi có region, main.js tự capture full primary screen rồi crop)
      await window.copilot.startScreenCC(screenSourceId || null);
      if (currentRegion) {
        ccBtn.textContent = '🎯 CC ON';
        ccBtn.title = `Region CC active — Vision OCR đọc vùng ${currentRegion.width}×${currentRegion.height}`;
      } else {
        ccBtn.textContent = '📺 CC ON';
        ccBtn.title = 'Screen CC active — Vision OCR đang đọc màn hình';
      }
    } else {
      // No screen source và no region → clipboard fallback
      await window.copilot.startClipboardWatch();
      ccBtn.textContent = '📋 CC ON';
      ccBtn.title = 'Clipboard CC active — copy text từ Otter.ai vào clipboard';
    }
    ccBtn.classList.add('cc-active');
    startBtn.disabled = true;
  } else {
    await window.copilot.stopScreenCC();
    await window.copilot.stopClipboardWatch();
    ccBtn.classList.remove('cc-active');
    ccBtn.textContent = '📋 CC';
    ccBtn.title = 'CC Mode — đọc text từ clipboard (otto.ai, Google Meet CC...)';
    startBtn.disabled = false;
  }
});

// ── CC Region selection ───────────────────────────────────────────────────────

let currentRegion = null;

function applyRegionUI(region) {
  currentRegion = region;
  if (region) {
    regionBtn.classList.add('region-active');
    regionBtn.title = `Vùng CC: ${region.width}×${region.height} — bấm để xóa`;
    regionBadge.textContent = `${region.width}×${region.height}`;
    regionBadge.style.display = 'inline-block';
  } else {
    regionBtn.classList.remove('region-active');
    regionBtn.title = 'Kéo chọn vùng CC trên màn hình — bấm lại để xóa';
    regionBadge.style.display = 'none';
    regionBadge.textContent = '';
  }
}

regionBtn.addEventListener('click', async () => {
  if (currentRegion) {
    // Already have a region → clear it
    await window.copilot.clearCCRegion();
    applyRegionUI(null);
    statusBar.textContent = 'Vùng CC đã xóa.';
  } else {
    // Open overlay to select new region
    statusBar.textContent = 'Kéo để chọn vùng CC…';
    await window.copilot.selectCCRegion();
  }
});

// Click badge to clear region too
regionBadge.addEventListener('click', async () => {
  await window.copilot.clearCCRegion();
  applyRegionUI(null);
  statusBar.textContent = 'Vùng CC đã xóa.';
});

window.copilot.onRegionConfirmed(region => {
  applyRegionUI(region);
  if (region && ccActive) {
    // CC đang chạy → restart với region mới (dù có hay không có screenSourceId)
    window.copilot.stopClipboardWatch();
    window.copilot.startScreenCC(screenSourceId || null);
    ccBtn.textContent = `🎯 CC ON`;
    ccBtn.title = `Region CC active — Vision OCR đọc vùng ${region.width}×${region.height}`;
  }
});

// Restore any saved region on startup
window.copilot.getCCRegion().then(r => { if (r) applyRegionUI(r); });

// ── Tab switcher for bilingual answers ───────────────────────────────────────
window.switchAnsTab = function(btn) {
  const uid  = btn.dataset.uid;
  const lang = btn.dataset.lang;
  const suggestion = btn.closest('.suggestion');

  suggestion.querySelectorAll('.ans-tab').forEach(b => b.classList.remove('active'));
  suggestion.querySelectorAll('.ans-pane').forEach(p => p.classList.remove('active'));

  btn.classList.add('active');
  const pane = document.getElementById(`${uid}-${lang}`);
  if (pane) pane.classList.add('active');
};

// ── Results rendering ─────────────────────────────────────────────────────────

window.copilot.onResult(({ text, utterances, result }) => {
  // Remove empty hint on first result
  const hint = suggestionResults.querySelector('.empty-hint');
  if (hint) hint.remove();

  let card = cardMap.get(text);
  if (!card) {
    card = document.createElement('div');
    card.className = 'result-card';
    cardMap.set(text, card);
    suggestionResults.insertBefore(card, suggestionResults.firstChild);
    if (cardMap.size > 20) cardMap.delete(cardMap.keys().next().value);
  }

  if (!result) {
    const loadUtterHtml = buildUtterancesHtml(utterances);
    card.innerHTML = `${loadUtterHtml || `<div class="transcript">"${text.slice(0,120)}${text.length>120?'…':''}"</div>`}<div class="analyzing-indicator">⏳ Analyzing...</div>`;
    return;
  }

  if (result._error) {
    card.innerHTML = `
      <div class="transcript">"${text.slice(0,120)}${text.length>120?'…':''}"</div>
      <div class="card-error">⚠ ${result._error.slice(0, 120)}</div>`;
    if (reverseAskList) {
      reverseAskList.innerHTML = '<div class="reverse-empty">Không lấy được gợi ý hỏi ngược vì phiên phân tích đang lỗi.</div>';
    }
    return;
  }

  const diffClass    = `difficulty-${result.difficulty || 'medium'}`;
  const showTrans    = showTranslation();

  const suggestionsHtml = (result.suggestions || []).map((s, i) => {
    const uid = `s${Date.now()}_${i}`;
    const answerVi = s.answer_vi || s.answer || s.answer_en || '';
    const answerEn = s.answer_en || s.answer || s.answer_vi || '';
    const tags = (s.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    return `
    <div class="suggestion">
      <div class="suggestion-header">
        <span class="suggestion-label">${s.label}</span>
        <div class="ans-tabs">
          <button class="ans-tab" data-uid="${uid}" data-lang="vi" onclick="switchAnsTab(this)">🇻🇳 VI</button>
          <button class="ans-tab active" data-uid="${uid}" data-lang="en" onclick="switchAnsTab(this)">🇬🇧 EN</button>
        </div>
        <div class="tags">${tags}</div>
      </div>
      <div class="ans-pane" id="${uid}-vi">${answerVi}</div>
      <div class="ans-pane active" id="${uid}-en">${answerEn}</div>
    </div>`;
  }).join('');

  const keywordsHtml = (result.keywords || []).map(k => `<span class="keyword">${k}</span>`).join('');

  const utterancesHtml = buildUtterancesHtml(utterances);

  card.innerHTML = `
    ${utterancesHtml || `<div class="transcript">"${text}"</div>`}
    <div class="translation" style="display:${showTrans ? '' : 'none'}">${result.translation || ''}</div>
    <div class="suggestions-title">Suggested Answers</div>
    ${suggestionsHtml}
    <div class="meta-row">
      ${keywordsHtml}
      <span class="difficulty-badge ${diffClass}">${result.difficulty || 'medium'}</span>
    </div>
  `;

  renderReverseAskBoard(result);
});
