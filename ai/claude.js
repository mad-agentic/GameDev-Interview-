const axios = require('axios');
const { buildSystemPrompt } = require('./prompt');
const { getProfile, getPortfolio, getSettings } = require('../store/context');

/**
 * Sends transcript text to Claude (or compatible provider) and returns structured suggestions.
 *
 * Provider modes (controlled by settings.aiProvider):
 *   'env'     — Anthropic native API, uses ANTHROPIC_KEY + CLAUDE_MODEL from .env
 *   '9router' — OpenAI-compatible, routes via 9router daemon at localhost:20128
 *   'custom'  — OpenAI-compatible, fully custom endpoint/key/model
 */
async function analyze(text, resume = '', answerStyle = 'spoken') {
  const { aiProvider, aiEndpoint, aiApiKey, aiModel } = getSettings();
  const systemPrompt = buildSystemPrompt(resume, getProfile(), answerStyle, getPortfolio());

  if (aiProvider === 'env') {
    return _callAnthropic(text, systemPrompt);
  }

  const endpoint = aiProvider === '9router'
    ? 'http://localhost:20128/v1/chat/completions'
    : `${(aiEndpoint || '').replace(/\/$/, '')}/chat/completions`;

  const model   = aiModel || (aiProvider === '9router' ? 'claude-haiku-4-5-20251014' : 'gpt-4o-mini');
  const apiKey  = aiApiKey || '';

  return _callOpenAICompat(endpoint, model, apiKey, text, systemPrompt);
}

// ── Anthropic native format ───────────────────────────────────────────────────

async function _callAnthropic(text, systemPrompt) {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251014',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      }
    }
  );

  const rawText = res?.data?.content?.[0]?.text;
  return _parseJsonResponse(rawText);
}

// ── OpenAI-compatible format (9router / custom) ───────────────────────────────

async function _callOpenAICompat(endpoint, model, apiKey, text, systemPrompt) {
  const res = await axios.post(
    endpoint,
    {
      model,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: text }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }
  );

  const rawText = res?.data?.choices?.[0]?.message?.content;
  return _parseJsonResponse(rawText);
}

// ── Shared JSON parser ────────────────────────────────────────────────────────

function _parseJsonResponse(rawText) {
  const body = typeof rawText === 'string' ? rawText.trim() : '';
  if (!body) throw new Error('Empty response body');

  const stripped = body.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonBlock = _extractBalancedJsonObject(stripped);
  if (!jsonBlock) throw new Error('No JSON in response: ' + body.slice(0, 120));

  const candidates = [
    jsonBlock,
    _cleanupLikelyJson(jsonBlock),
    _cleanupLikelyJson(jsonBlock, { removeTrailingCommas: true, normalizeQuotes: true })
  ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error('JSON parse error: ' + (lastError?.message || 'Unknown parse failure') + ' | raw: ' + jsonBlock.slice(0, 120));
}

function _extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return '';

  let inString = false;
  let isEscaped = false;
  let depth = 0;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return '';
}

function _cleanupLikelyJson(text, options = {}) {
  const removeTrailingCommas = options.removeTrailingCommas !== false;
  const normalizeQuotes = options.normalizeQuotes !== false;

  let cleaned = String(text || '')
    .replace(/^[\uFEFF\s]+/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  if (normalizeQuotes) {
    cleaned = cleaned
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
  }

  if (removeTrailingCommas) {
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  }

  return cleaned;
}

module.exports = { analyze };
