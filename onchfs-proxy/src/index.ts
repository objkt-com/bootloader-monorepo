import { Hono, Context } from 'hono';
import { Env, NETWORKS } from './types';
import { R2Storage } from './storage';
import { guessContentType, isValidCid } from './utils';
import { LANDING_HTML } from './landing';

export { OnchFSSyncObject } from './durable-object';

const app = new Hono<{ Bindings: Env }>();

// Helper function to sanitize header values
function sanitizeHeaderValue(value: string): string {
  // Remove any characters outside valid HTTP header range
  // Headers must contain only characters in the range 0x20-0x7E and tab (0x09)
  const chars: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code >= 0x20 && code <= 0x7e) || code === 0x09) {
      chars.push(code);
    }
  }
  return String.fromCharCode(...chars);
}

// Helper function to build response headers
function buildResponseHeaders(
  contentType: string,
  network: string,
  cacheStatus: 'HIT' | 'MISS',
  metadata: R2HTTPMetadata = {}
): Headers {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Cache', cacheStatus);
  headers.set('X-Network', network);

  // CORS headers for cross-origin browser access
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');

  // Note: We don't set Content-Encoding because we decompress gzipped content server-side
  // Only set other metadata headers
  if (metadata.contentLanguage) {
    headers.set('Content-Language', sanitizeHeaderValue(metadata.contentLanguage));
  }
  if (metadata.contentDisposition) {
    headers.set('Content-Disposition', sanitizeHeaderValue(metadata.contentDisposition));
  }

  return headers;
}

// Helper to build response from R2 object
async function buildR2Response(
  r2Object: R2ObjectBody,
  network: string,
  path: string | undefined,
  cacheKey: Request,
  cache: Cache,
  ctx: ExecutionContext
): Promise<Response> {
  const content = await r2Object.arrayBuffer();
  const metadata = r2Object.httpMetadata || {};

  // Determine content type - sanitize to ensure valid header values
  const contentType = sanitizeHeaderValue(
    metadata.contentType || (path ? guessContentType(path) : 'application/octet-stream')
  );

  const headers = buildResponseHeaders(contentType, network, 'MISS', metadata);

  const finalResponse = new Response(content, {
    status: 200,
    headers,
  });

  // Store in edge cache
  ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

  return finalResponse;
}

// Helper function to handle CID requests with optional file path
async function handleCidRequest(c: Context<{ Bindings: Env }>, network: string, cid: string, path?: string) {
  const storage = new R2Storage(c.env.ONCHFS_BUCKET, network);

  // If no path, redirect to index.html explicitly
  if (!path) {
    const url = new URL(c.req.url);
    // Check if this is a directory by checking if index.html exists in R2
    const testIndexHtml = await storage.getFile(cid, 'index.html');
    if (testIndexHtml) {
      // Redirect to explicit index.html (preserves query params)
      url.pathname = url.pathname.replace(/\/?$/, '/index.html');
      return c.redirect(url.toString(), 302);
    }
  }

  // Try Cache API first (edge cache)
  const cacheKey = new Request(c.req.url, c.req.raw);
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (response) {
    // Add cache hit header
    response = new Response(response.body, response);
    response.headers.set('X-Cache', 'HIT');
    return response;
  }

  // Try R2 storage
  const r2Object = await storage.getFile(cid, path);

  if (r2Object) {
    return buildR2Response(r2Object, network, path, cacheKey, cache, c.executionCtx);
  }

  // File not in R2, need to fetch from chain via Durable Object
  // Use Durable Object to synchronize concurrent requests
  const id = c.env.ONCHFS_SYNC.idFromName(`${network}:${cid}:${path || ''}`);
  const stub = c.env.ONCHFS_SYNC.get(id);

  const doRequest = new Request('https://internal/fetch', {
    method: 'POST',
    body: JSON.stringify({ network, cid, path }),
    headers: { 'Content-Type': 'application/json' },
  });

  const doResponse = await stub.fetch(doRequest);

  if (!doResponse.ok) {
    return c.text('Not found', 404);
  }

  // Now file should be in R2, fetch it again
  const r2ObjectRetry = await storage.getFile(cid, path);

  if (!r2ObjectRetry) {
    return c.text('Error fetching from chain', 500);
  }

  return buildR2Response(r2ObjectRetry, network, path, cacheKey, cache, c.executionCtx);
}

// Testnet routes with explicit network - must come before mainnet routes
// /{network}/v1/{cid}/{path} - with file path
app.get('/:network/v1/:cid/*', async (c) => {
  const network = c.req.param('network');
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.text('Invalid CID format', 400);
  }

  if (!NETWORKS[network]) {
    return c.text('Invalid network', 400);
  }

  // Extract path from the wildcard
  const fullPath = c.req.path;
  const pathMatch = fullPath.match(/^\/[^/]+\/v1\/[^/]+\/(.+)$/);
  const path = pathMatch ? pathMatch[1] : undefined;

  return handleCidRequest(c, network, cid, path);
});

// /{network}/v1/{cid} - without file path
app.get('/:network/v1/:cid', async (c) => {
  const network = c.req.param('network');
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.text('Invalid CID format', 400);
  }

  if (!NETWORKS[network]) {
    return c.text('Invalid network', 400);
  }

  return handleCidRequest(c, network, cid);
});

// Mainnet routes (default, no network prefix)
// /v1/{cid}/{path} - with file path
app.get('/v1/:cid/*', async (c) => {
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.text('Invalid CID format', 400);
  }

  // Extract path from the wildcard
  const fullPath = c.req.path;
  const pathMatch = fullPath.match(/^\/v1\/[^/]+\/(.+)$/);
  const path = pathMatch ? pathMatch[1] : undefined;

  return handleCidRequest(c, 'mainnet', cid, path);
});

// /v1/{cid} - without file path
app.get('/v1/:cid', async (c) => {
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.text('Invalid CID format', 400);
  }

  return handleCidRequest(c, 'mainnet', cid);
});

// OPTIONS handler for CORS preflight
app.options('/*', () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});

// HEAD request support for /{network}/v1/{cid}/{path}
app.on('HEAD', '/:network/v1/:cid/*', async (c) => {
  const network = c.req.param('network');
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.body(null, 400);
  }

  if (!NETWORKS[network]) {
    return c.body(null, 400);
  }

  const fullPath = c.req.path;
  const pathMatch = fullPath.match(/^\/[^/]+\/v1\/[^/]+\/(.+)$/);
  const path = pathMatch ? pathMatch[1] : undefined;

  const storage = new R2Storage(c.env.ONCHFS_BUCKET, network);
  const r2Object = await storage.getFile(cid, path);

  if (!r2Object) {
    return c.body(null, 404);
  }

  const metadata = r2Object.httpMetadata || {};
  const contentType = sanitizeHeaderValue(
    metadata.contentType || (path ? guessContentType(path) : 'application/octet-stream')
  );

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(r2Object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Network', network);

  if (metadata.contentLanguage) {
    headers.set('Content-Language', sanitizeHeaderValue(metadata.contentLanguage));
  }
  if (metadata.contentDisposition) {
    headers.set('Content-Disposition', sanitizeHeaderValue(metadata.contentDisposition));
  }

  return c.body(null, 200, Object.fromEntries(headers));
});

// HEAD request support for /{network}/v1/{cid}
app.on('HEAD', '/:network/v1/:cid', async (c) => {
  const network = c.req.param('network');
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.body(null, 400);
  }

  if (!NETWORKS[network]) {
    return c.body(null, 400);
  }

  const storage = new R2Storage(c.env.ONCHFS_BUCKET, network);
  const r2Object = await storage.getFile(cid);

  if (!r2Object) {
    return c.body(null, 404);
  }

  const metadata = r2Object.httpMetadata || {};
  const contentType = sanitizeHeaderValue(metadata.contentType || 'application/octet-stream');

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(r2Object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Network', network);

  if (metadata.contentLanguage) {
    headers.set('Content-Language', sanitizeHeaderValue(metadata.contentLanguage));
  }
  if (metadata.contentDisposition) {
    headers.set('Content-Disposition', sanitizeHeaderValue(metadata.contentDisposition));
  }

  return c.body(null, 200, Object.fromEntries(headers));
});

// HEAD request support for /v1/{cid}/{path}
app.on('HEAD', '/v1/:cid/*', async (c) => {
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.body(null, 400);
  }

  const fullPath = c.req.path;
  const pathMatch = fullPath.match(/^\/v1\/[^/]+\/(.+)$/);
  const path = pathMatch ? pathMatch[1] : undefined;

  const storage = new R2Storage(c.env.ONCHFS_BUCKET, 'mainnet');
  const r2Object = await storage.getFile(cid, path);

  if (!r2Object) {
    return c.body(null, 404);
  }

  const metadata = r2Object.httpMetadata || {};
  const contentType = sanitizeHeaderValue(
    metadata.contentType || (path ? guessContentType(path) : 'application/octet-stream')
  );

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(r2Object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Network', 'mainnet');

  if (metadata.contentLanguage) {
    headers.set('Content-Language', sanitizeHeaderValue(metadata.contentLanguage));
  }
  if (metadata.contentDisposition) {
    headers.set('Content-Disposition', sanitizeHeaderValue(metadata.contentDisposition));
  }

  return c.body(null, 200, Object.fromEntries(headers));
});

// HEAD request support for /v1/{cid}
app.on('HEAD', '/v1/:cid', async (c) => {
  const cid = c.req.param('cid');

  if (!isValidCid(cid)) {
    return c.body(null, 400);
  }

  const storage = new R2Storage(c.env.ONCHFS_BUCKET, 'mainnet');
  const r2Object = await storage.getFile(cid);

  if (!r2Object) {
    return c.body(null, 404);
  }

  const metadata = r2Object.httpMetadata || {};
  const contentType = sanitizeHeaderValue(metadata.contentType || 'application/octet-stream');

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Length', String(r2Object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Network', 'mainnet');

  if (metadata.contentLanguage) {
    headers.set('Content-Language', sanitizeHeaderValue(metadata.contentLanguage));
  }
  if (metadata.contentDisposition) {
    headers.set('Content-Disposition', sanitizeHeaderValue(metadata.contentDisposition));
  }

  return c.body(null, 200, Object.fromEntries(headers));
});

// Root route - landing page
app.get('/', (c) => {
  return c.html(LANDING_HTML);
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

export default app;
