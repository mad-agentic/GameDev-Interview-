const axios = require('axios');

async function translateBilingual(text) {
  const input = String(text || '').trim();
  if (!input) return { vi: '', en: '' };

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 280,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a translation engine. Return ONLY JSON: {"vi":"...","en":"..."}. Keep meaning exact and concise. Do not add commentary.'
        },
        {
          role: 'user',
          content: `Translate this transcript chunk into both Vietnamese and English. If source is already one language, still provide both fields. Text:\n${input}`
        }
      ]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_KEY}`
      }
    }
  );

  const raw = res.data?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  return {
    vi: String(parsed.vi || '').trim() || input,
    en: String(parsed.en || '').trim() || input
  };
}

module.exports = { translateBilingual };
