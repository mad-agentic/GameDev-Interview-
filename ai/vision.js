const axios = require('axios');

/**
 * Extracts subtitle/CC text from a screenshot using OpenAI Vision.
 * @param {string} dataUrl - base64 data URL of the screenshot
 * @returns {Promise<string>} Extracted caption text, or '' if none found
 */
async function extractCCText(dataUrl) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'low' }
          },
          {
            type: 'text',
            text: 'Extract ONLY the subtitle or closed-caption text visible in this screenshot (usually shown at the bottom of the screen by tools like Otter.ai, Google Meet CC, etc.). Return just the raw caption text — no explanation, no quotes. If no captions are visible, return exactly: [none]'
          }
        ]
      }],
      max_tokens: 300
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_KEY}`
      }
    }
  );

  const text = res.data.choices[0].message.content.trim();
  return text === '[none]' ? '' : text;
}

module.exports = { extractCCText };
