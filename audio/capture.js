let cachedNaudiodon = null;

function loadNaudiodon() {
  if (cachedNaudiodon) return cachedNaudiodon;

  const Module = require('module');
  const originalLoad = Module._load;

  // naudiodon auto-registers segfault-handler on import. In Electron this can
  // destabilize shutdown paths, so we no-op that optional dependency.
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'segfault-handler') {
      return {
        registerHandler: () => {},
        causeSegfault: () => {}
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    cachedNaudiodon = require('naudiodon');
    return cachedNaudiodon;
  } finally {
    Module._load = originalLoad;
  }
}

/**
 * Returns a list of all available audio input devices.
 * Look for "Stereo Mix", "CABLE Output", or similar loopback devices.
 */
function listDevices() {
  const naudiodon = loadNaudiodon();
  return naudiodon.getDevices().filter(d => d.maxInputChannels > 0);
}

/**
 * Starts capturing audio from the specified device.
 * Collects ~3 seconds of audio (30 chunks) then calls onChunk with the combined buffer.
 *
 * @param {number} deviceId - Device ID from listDevices()
 * @param {function(Buffer): void} onChunk - Called with each 3-second PCM buffer
 * @returns {object} naudiodon AudioIO instance — call .quit() to stop
 */
function startCapture(deviceId, chunkCount = 10, onChunk) {
  const naudiodon = loadNaudiodon();
  const ai = new naudiodon.AudioIO({
    inOptions: {
      channelCount: 2,
      sampleFormat: naudiodon.SampleFormat16Bit,
      sampleRate: 16000,
      deviceId: deviceId,
      closeOnError: false
    }
  });

  let buffer = [];

  ai.on('data', (chunk) => {
    buffer.push(chunk);
    if (buffer.length >= chunkCount) {
      onChunk(Buffer.concat(buffer));
      buffer = [];
    }
  });

  ai.on('error', (err) => {
    console.error('[capture] Audio error:', err.message);
  });

  ai.start();
  return ai;
}

module.exports = { listDevices, startCapture };
