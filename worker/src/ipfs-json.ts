import type { Bindings } from './types';
import { isFilebaseConfigured, uploadJsonToFilebase } from './filebase';

export const MAX_METADATA_JSON_BYTES = 256 * 1024;

export class IpfsJsonError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'IpfsJsonError';
    this.status = status;
  }
}

export interface StoredIpfsJson {
  cid: string;
  rawCid: string;
  key: string;
  size: number;
  backend: 'filebase' | 'r2-fallback';
}

/**
 * Store JSON metadata in Filebase (preferred) or R2 fallback.
 * The returned CID always includes the ipfs:// prefix for on-chain usage.
 */
export async function storeJsonToIpfs(
  env: Bindings,
  payload: unknown,
  actor: string
): Promise<StoredIpfsJson> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new IpfsJsonError(400, 'Request body must be a JSON object');
  }

  const jsonString = JSON.stringify(payload, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonString);
  if (jsonBytes.length > MAX_METADATA_JSON_BYTES) {
    throw new IpfsJsonError(
      413,
      `Metadata JSON too large (${jsonBytes.length} bytes). Max ${MAX_METADATA_JSON_BYTES} bytes.`
    );
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', jsonBytes);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray, (byte) => byte.toString(16).padStart(2, '0')).join('');

  const envName = (env.ENVIRONMENT || '').trim().toLowerCase();
  const requiresPublicIpfs = envName === 'staging' || envName === 'production';
  const filebaseReady = isFilebaseConfigured(env);

  if (filebaseReady) {
    const keyHint = hashHex.slice(0, 40);
    const uploaded = await uploadJsonToFilebase(env, keyHint, jsonString);

    await env.R2_SANDBOX.put(`${uploaded.cid}/metadata.json`, jsonString, {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        actor,
        uploadedAt: new Date().toISOString(),
        backend: 'filebase',
      },
    });

    return {
      cid: `ipfs://${uploaded.cid}`,
      rawCid: uploaded.cid,
      key: uploaded.key,
      size: jsonBytes.length,
      backend: 'filebase',
    };
  }

  if (requiresPublicIpfs) {
    throw new IpfsJsonError(
      500,
      'Filebase is required for metadata uploads in this environment. Configure FILEBASE_ACCESS_KEY, FILEBASE_SECRET_KEY, and FILEBASE_BUCKET.'
    );
  }

  const fallbackCid = `json-${hashHex.slice(0, 40)}`;
  const fallbackKey = `${fallbackCid}/metadata.json`;
  await env.R2_SANDBOX.put(fallbackKey, jsonString, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      actor,
      uploadedAt: new Date().toISOString(),
      backend: 'r2-fallback',
    },
  });

  return {
    cid: `ipfs://${fallbackCid}`,
    rawCid: fallbackCid,
    key: fallbackKey,
    size: jsonBytes.length,
    backend: 'r2-fallback',
  };
}
