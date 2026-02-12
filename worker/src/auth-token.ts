import type { User } from './types';

const DEFAULT_AUTH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface AuthTokenClaims {
  sub: string;
  address: string;
  roles: number;
  iat: number;
  exp: number;
}

export function getAuthTokenTtlSeconds(raw?: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_AUTH_TOKEN_TTL_SECONDS;
  const ttl = Math.trunc(parsed);
  return Math.max(60, Math.min(ttl, 30 * 24 * 60 * 60));
}

export async function signAuthToken(user: User, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: AuthTokenClaims = {
    sub: user.id,
    address: user.address,
    roles: user.roles,
    iat: now,
    exp: now + ttlSeconds,
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encodedHeader = encodeObject(header);
  const encodedClaims = encodeObject(claims);
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await hmacSha256Base64Url(secret, signingInput);
  return `${signingInput}.${signature}`;
}

export async function verifyAuthToken(token: string, secret: string): Promise<AuthTokenClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) return null;

  const expectedSignature = await hmacSha256Base64Url(secret, `${encodedHeader}.${encodedClaims}`);
  if (!constantTimeEqual(expectedSignature, encodedSignature)) return null;

  const header = decodeObject<Record<string, unknown>>(encodedHeader);
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;

  const claims = decodeObject<AuthTokenClaims>(encodedClaims);
  if (!claims || typeof claims !== 'object') return null;

  if (
    typeof claims.sub !== 'string' ||
    typeof claims.address !== 'string' ||
    typeof claims.roles !== 'number' ||
    typeof claims.iat !== 'number' ||
    typeof claims.exp !== 'number'
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return null;
  if (claims.iat > now + 60) return null;

  return claims;
}

function encodeObject(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncode(bytes);
}

function decodeObject<T>(encoded: string): T | null {
  try {
    const bytes = base64UrlDecode(encoded);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(secret);
  const payloadBytes = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, payloadBytes);
  return base64UrlEncode(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}
