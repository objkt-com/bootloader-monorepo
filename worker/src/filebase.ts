import type { Bindings } from './types';

const DEFAULT_FILEBASE_ENDPOINT = 'https://s3.filebase.com';
const AWS_REGION = 'us-east-1';
const AWS_SERVICE = 's3';

type ByteInput = string | Uint8Array | ArrayBuffer;

interface FilebaseConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export function isFilebaseConfigured(env: Bindings): boolean {
  return Boolean(env.FILEBASE_ACCESS_KEY && env.FILEBASE_SECRET_KEY && env.FILEBASE_BUCKET);
}

function getFilebaseConfig(env: Bindings): FilebaseConfig {
  const accessKey = env.FILEBASE_ACCESS_KEY?.trim();
  const secretKey = env.FILEBASE_SECRET_KEY?.trim();
  const bucket = env.FILEBASE_BUCKET?.trim();
  const endpoint = (env.FILEBASE_ENDPOINT || DEFAULT_FILEBASE_ENDPOINT).trim().replace(/\/+$/, '');

  if (!accessKey || !secretKey || !bucket) {
    throw new Error('Filebase is not configured. Missing FILEBASE_ACCESS_KEY, FILEBASE_SECRET_KEY, or FILEBASE_BUCKET.');
  }

  return {
    endpoint,
    accessKey,
    secretKey,
    bucket,
  };
}

function toUint8Array(input: ByteInput): Uint8Array {
  if (typeof input === 'string') {
    return new TextEncoder().encode(input);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return input;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input: ByteInput): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toUint8Array(input));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256(key: ByteInput, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toUint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

function formatAmzDate(now: Date): { amzDate: string; shortDate: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const amzDate = iso.slice(0, 15) + 'Z';
  const shortDate = amzDate.slice(0, 8);
  return { amzDate, shortDate };
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function buildSigningKey(secretKey: string, shortDate: string): Promise<Uint8Array> {
  const kDate = await hmacSha256(`AWS4${secretKey}`, shortDate);
  const kRegion = await hmacSha256(kDate, AWS_REGION);
  const kService = await hmacSha256(kRegion, AWS_SERVICE);
  return hmacSha256(kService, 'aws4_request');
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function signedPutObject(
  env: Bindings,
  key: string,
  body: Uint8Array,
  options?: {
    contentType?: string;
    metadata?: Record<string, string>;
  }
): Promise<Response> {
  const cfg = getFilebaseConfig(env);
  const now = new Date();
  const { amzDate, shortDate } = formatAmzDate(now);
  const host = new URL(cfg.endpoint).host;
  const canonicalUri = `/${cfg.bucket}/${encodeObjectKey(key)}`;
  const payloadHash = await sha256Hex(body);

  const headersForSigning = new Map<string, string>();
  headersForSigning.set('host', host);
  headersForSigning.set('x-amz-content-sha256', payloadHash);
  headersForSigning.set('x-amz-date', amzDate);

  if (options?.contentType) {
    headersForSigning.set('content-type', options.contentType);
  }

  for (const [metaKey, metaValue] of Object.entries(options?.metadata || {})) {
    if (!metaKey || metaValue == null) continue;
    headersForSigning.set(`x-amz-meta-${metaKey.toLowerCase()}`, String(metaValue));
  }

  const sortedHeaderEntries = Array.from(headersForSigning.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalHeaders = sortedHeaderEntries
    .map(([name, value]) => `${name}:${normalizeHeaderValue(value)}\n`)
    .join('');
  const signedHeaders = sortedHeaderEntries.map(([name]) => name).join(';');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${shortDate}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await buildSigningKey(cfg.secretKey, shortDate);
  const signature = bytesToHex(await hmacSha256(signingKey, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const requestHeaders = new Headers();
  requestHeaders.set('host', host);
  requestHeaders.set('x-amz-content-sha256', payloadHash);
  requestHeaders.set('x-amz-date', amzDate);
  requestHeaders.set('authorization', authorization);

  if (options?.contentType) {
    requestHeaders.set('content-type', options.contentType);
  }

  for (const [metaKey, metaValue] of Object.entries(options?.metadata || {})) {
    if (!metaKey || metaValue == null) continue;
    requestHeaders.set(`x-amz-meta-${metaKey.toLowerCase()}`, String(metaValue));
  }

  return fetch(`${cfg.endpoint}${canonicalUri}`, {
    method: 'PUT',
    headers: requestHeaders,
    body,
  });
}

async function requireCidFromResponse(response: Response, context: string): Promise<string> {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${context} failed (${response.status}): ${body || 'Unknown error'}`);
  }

  const cid = response.headers.get('x-amz-meta-cid');
  if (!cid) {
    throw new Error(`${context} succeeded but Filebase did not return x-amz-meta-cid.`);
  }

  return cid;
}

export async function uploadCarToFilebase(
  env: Bindings,
  cidHint: string,
  carBytes: Uint8Array
): Promise<{ cid: string; key: string }> {
  const key = `car/${cidHint}.car`;
  const response = await signedPutObject(env, key, carBytes, {
    contentType: 'application/vnd.ipld.car',
    metadata: { import: 'car' },
  });
  const cid = await requireCidFromResponse(response, 'Filebase CAR upload');
  if (cid !== cidHint) {
    throw new Error(
      `Filebase returned CID ${cid}, but local CAR root was ${cidHint}. Refusing inconsistent upload result.`
    );
  }
  return { cid, key };
}

export async function uploadJsonToFilebase(
  env: Bindings,
  keyHint: string,
  jsonString: string
): Promise<{ cid: string; key: string }> {
  const key = `metadata/${keyHint}.json`;
  const body = new TextEncoder().encode(jsonString);
  const response = await signedPutObject(env, key, body, {
    contentType: 'application/json',
  });
  const cid = await requireCidFromResponse(response, 'Filebase JSON upload');
  return { cid, key };
}
