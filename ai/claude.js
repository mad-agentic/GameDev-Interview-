const axios = require('axios');
const { buildSystemPrompt } = require('./prompt');

/**
 * Sends transcript text to Claude and returns structured game dev interview suggestions.
 *
 * @param {string} text - Transcribed interview speech
 * @param {string} resume - Optional candidate resume for personalization
 * @returns {Promise<{translation: string, suggestions: Array, keywords: Array, difficulty: string}>}
 */
async function analyze(text, resume = '') {
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: buildSystemPrompt(resume),
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

  const body = res.data.content[0].text;
  // Extract JSON object even if Claude wraps it in markdown or adds preamble
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response: ' + body.slice(0, 100));
  return JSON.parse(match[0]);
}

module.exports = { analyze };
