/* Bootloader 1.0.0
   - $bootloader.capture() - signal that artwork is ready for thumbnail capture
   - $bootloader.setFeatures({ key: value }) - set token attributes/traits
   - $bootloader.rnd - seeded random number generator (0-1)
   - $bootloader.hash - 32-char hex seed
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
        const origin = document.referrer ? new URL(document.referrer).origin : '*';
        window.parent.postMessage(msg, origin);
      }
    } catch {
      // ignore cross-origin issues
    }
  }

  function parseSeed(hex) {
    if (!hex || typeof hex !== 'string') {
      hex = Array(32)
        .fill(0)
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');
    }
    hex = hex.replace(/[^0-9a-f]/gi, 'f').padStart(32, '0').toLowerCase();
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

  function u32ToHex(u32) {
    return Array.from(u32, (v) => v.toString(16).padStart(8, '0')).join('');
  }

  const q = new URLSearchParams(location.search);
  const seed = q.get('s');
  const rnd = sfc32(parseSeed(seed));

  window.$bootloader = {
    version: VERSION,
    hash: u32ToHex(parseSeed(seed)),
    rnd,
    iteration: parseInt(q.get('i') || '1', 10),
    isCapture: q.get('c') === 'true',

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
