/* Bootloader 1.0.0
   - $bootloader.capture() - signal that artwork is ready for thumbnail capture
   - $bootloader.setFeatures({ key: value }) - set token attributes/traits
   - $bootloader.rnd - seeded random number generator (0-1)
   - $bootloader.hash - 64-char hex seed
   - $bootloader.iteration - edition number
   - $bootloader.isCapture - true when in capture mode
*/
(function () {
  'use strict';

  const VERSION = '1.0.0';

  function post(id, data) {
    const msg = { id: `bootloader:${id}`, data, timestamp: Date.now() };
    try {
      if (window.parent && window.parent !== window) {
        const candidateOrigin = document.referrer
          ? new URL(document.referrer).origin
          : '*';
        const origin = candidateOrigin && candidateOrigin !== 'null' ? candidateOrigin : '*';
        window.parent.postMessage(msg, origin);
      }
    } catch {
      // ignore cross-origin issues
    }
  }

  function normalizeSeed(hex) {
    if (!hex || typeof hex !== 'string') {
      hex = Array(64)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');
    }
    return hex
      .trim()
      .replace(/^0x/i, '')
      .replace(/[^0-9a-f]/gi, 'f')
      .toLowerCase()
      .slice(-64)
      .padStart(64, '0');
  }

  function parseSeed(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
    const abcd = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      abcd[i] =
        (bytes[i * 4] << 24) |
        (bytes[i * 4 + 1] << 16) |
        (bytes[i * 4 + 2] << 8) |
        bytes[i * 4 + 3];
    }
    for (let i = 16; i < bytes.length; i++) {
      const idx = i - 16;
      const wi = idx % 4;
      const shift = (3 - (idx % 4)) * 8;
      abcd[wi] ^= bytes[i] << shift;
    }
    if (!(abcd[0] | abcd[1] | abcd[2] | abcd[3])) abcd[3] = 1;
    return abcd;
  }

  function sfc32(seed) {
    let [a, b, c, d] = [...seed];
    const g = function () {
      a |= 0;
      b |= 0;
      c |= 0;
      d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    g.reset = () => {
      [a, b, c, d] = [...seed];
    };
    return g;
  }

  const q = new URLSearchParams(location.search);
  const previewConfig =
    window.__BOOTLOADER_PREVIEW__ &&
    typeof window.__BOOTLOADER_PREVIEW__ === 'object'
      ? window.__BOOTLOADER_PREVIEW__
      : null;
  const seed =
    previewConfig && typeof previewConfig.seed === 'string'
      ? previewConfig.seed
      : q.get('s');
  const normalizedSeed = normalizeSeed(seed);
  const parsedSeed = parseSeed(normalizedSeed);
  const rnd = sfc32(parsedSeed);
  const previewIteration = Number(
    previewConfig && typeof previewConfig.iteration !== 'undefined'
      ? previewConfig.iteration
      : Number.NaN
  );
  const iteration = Number.isFinite(previewIteration)
    ? Math.max(1, Math.trunc(previewIteration))
    : parseInt(q.get('i') || '1', 10);
  const isCapture =
    (previewConfig && previewConfig.isCapture === true) || q.get('c') === 'true';

  window.$bootloader = {
    version: VERSION,
    hash: normalizedSeed,
    rnd,
    iteration,
    isCapture,

    setFeatures(obj) {
      if (obj === undefined || obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;
      post('features', obj);
    },

    _captured: false,
    capture() {
      if (this._captured) return;
      this._captured = true;
      post('capture', null);
    },
  };

  post('ready', { version: VERSION });
})();
