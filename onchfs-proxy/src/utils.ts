export function isValidCid(cid: string): boolean {
  // Keccak-256 hash: exactly 64 hex characters
  // Fast path: length check first (O(1))
  if (cid.length !== 64) return false;

  // Check all characters are hex (0-9, a-f, A-F)
  // This is extremely fast - just 64 character code comparisons
  for (let i = 0; i < 64; i++) {
    const c = cid.charCodeAt(i);
    if (!((c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70))) {
      return false;
    }
  }
  return true;
}

export function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    txt: 'text/plain',
    xml: 'application/xml',
    pdf: 'application/pdf',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
  };
  return types[ext || ''] || 'application/octet-stream';
}
