const axios  = require('axios');
const { pcmToWav } = require('../audio/pcm-to-wav');

const BASE = 'https://api.assemblyai.com/v2';

function headers() {
  return { authorization: process.env.ASSEMBLYAI_KEY };
}

/**
 * Detects raw PCM by checking for missing RIFF/WebM/ID3/OGG magic bytes.
 */
function isRawPcm(buffer) {
  if (buffer.length < 4) return false;
  const magic = buffer.slice(0, 4).toString('ascii');
  return !['RIFF', 'OggS', '\x1aE'].some(m => magic.startsWith(m))
      && buffer[0] !== 0x1a; // not EBML (webm)
}

/**
 * Transcribes audio with speaker diarization via AssemblyAI.
 * @param {Buffer} buffer - Raw audio buffer (webm, wav, pcm, etc.)
 * @returns {Promise<Array<{speaker: string, text: string}>>} Utterances per speaker
 */
async function transcribeWithSpeakers(buffer) {
  // Convert raw PCM → WAV so AssemblyAI can parse it
  const pcm         = isRawPcm(buffer);
  const audioBuffer = pcm ? pcmToWav(buffer, 16000, 2) : buffer;
  const contentType = pcm ? 'audio/wav' : 'application/octet-stream';

  // 1. Upload audio
  const uploadRes = await axios.post(`${BASE}/upload`, audioBuffer, {
    headers: { ...headers(), 'content-type': contentType },
    maxBodyLength: Infinity
  });
  const audioUrl = uploadRes.data.upload_url;

  // 2. Submit transcription job with speaker labels
  const jobRes = await axios.post(`${BASE}/transcript`, {
    audio_url: audioUrl,
    speaker_labels: true,
    language_detection: true
  }, { headers: headers() });
  const jobId = jobRes.data.id;

  // 3. Poll until completed
  for (;;) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await axios.get(`${BASE}/transcript/${jobId}`, { headers: headers() });
    const { status, error, utterances } = poll.data;
    if (status === 'completed') {
      return (utterances || []).map(u => ({
        speaker: u.speaker,       // "A", "B", "C"...
        text:    u.text
      }));
    }
    if (status === 'error') throw new Error('AssemblyAI: ' + error);
  }
}

module.exports = { transcribeWithSpeakers };
