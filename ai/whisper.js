const FormData = require('form-data');
const axios = require('axios');
const { pcmToWav } = require('../audio/pcm-to-wav');

// Context hint for Whisper — improves accuracy for game dev / interview vocabulary
const WHISPER_PROMPT =
  'Game developer job interview. Unity, C#, Unreal, bug, shader, gameplay loop, ' +
  'ECS, draw calls, frame budget, GC allocation, object pooling, addressables, ' +
  'WebGL, Firebase, NFT, blockchain, Play-to-Earn, GameFi, smart contract, ' +
  'Agile, Scrum, sprint, technical lead, code review, CI/CD, optimization, ' +
  'mobile game, casual game, hyper-casual, live ops, monetization, AdMob, IAP. ' +
  'Vietnamese and English mixed conversation.';

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
  form.append('prompt', WHISPER_PROMPT);
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

async function transcribeWebm(buffer) {
  const form = new FormData();
  form.append('file', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
  form.append('model', 'whisper-1');
  form.append('prompt', WHISPER_PROMPT);

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

module.exports = { transcribe, transcribeWebm };
