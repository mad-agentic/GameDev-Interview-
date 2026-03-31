const FormData = require('form-data');
const axios = require('axios');
const { pcmToWav } = require('../audio/pcm-to-wav');

/**
 * Transcribes a PCM audio buffer using OpenAI Whisper API.
 * Auto-detects language (EN or VN).
 *
 * @param {Buffer} pcmBuffer - Raw 16-bit stereo PCM at 16kHz
 * @returns {Promise<string>} Transcribed text
 */
async function transcribe(pcmBuffer) {
  const wav = pcmToWav(pcmBuffer, 16000, 2);

  const form = new FormData();
  form.append('file', wav, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('model', 'whisper-1');
  // No 'language' param → auto-detect EN/VN

  const res = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_KEY}`
      }
    }
  );

  return res.data.text;
}

module.exports = { transcribe };
