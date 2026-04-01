const axios = require('axios');
const { buildSystemPrompt } = require('./prompt');
const { getProfile, getPortfolio } = require('../store/context');

/**
 * Sends transcript text to Claude and returns structured game dev interview suggestions.
 *
 * @param {string} text - Transcribed interview speech
 * @param {string} resume - Optional candidate resume for personalization
 * @returns {Promise<{translation: string, suggestions: Array, keywords: Array, difficulty: string}>}
 */
async function analyze(text, resume = '', answerStyle = 'spoken') {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251014',
      max_tokens: 1200,
        system: buildSystemPrompt(resume, getProfile(), answerStyle, getPortfolio()),
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
  const body = typeof rawText === 'string' ? rawText.trim() : '';

  if (!body) {
    throw new Error('Empty Claude response body');
  }

  // Strip markdown fences if present
  const stripped = body.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Extract outermost JSON object
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response: ' + body.slice(0, 120));

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new Error('JSON parse error: ' + e.message + ' | raw: ' + match[0].slice(0, 80));
  }
}

module.exports = { analyze };
