/**
 * Converts a raw PCM buffer to a WAV buffer with a standard 44-byte header.
 * @param {Buffer} pcmBuffer - Raw 16-bit PCM audio data
 * @param {number} sampleRate - Sample rate in Hz (default: 16000)
 * @param {number} channels - Number of channels (default: 2 for stereo)
 * @returns {Buffer} WAV-formatted buffer ready for upload
 */
function pcmToWav(pcmBuffer, sampleRate = 16000, channels = 2) {
  const dataLen = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // PCM chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34);           // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);

  return Buffer.concat([header, pcmBuffer]);
}

module.exports = { pcmToWav };
