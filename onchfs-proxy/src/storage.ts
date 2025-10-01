import { FileInode, DirectoryInode } from './types';

export class R2Storage {
  constructor(
    private bucket: R2Bucket,
    private network: string
  ) {}

  private getKey(cid: string, path?: string): string {
    // Store files in R2 with network prefix to avoid mixing networks
    // Format: {network}/{cid} or {network}/{cid}/{path}
    if (path) {
      return `${this.network}/${cid}/${path}`;
    }
    return `${this.network}/${cid}`;
  }

  async getFile(cid: string, path?: string): Promise<R2ObjectBody | null> {
    const key = this.getKey(cid, path);
    return await this.bucket.get(key);
  }

  async putFile(
    cid: string,
    content: Uint8Array,
    metadata: Record<string, string>,
    path?: string
  ): Promise<void> {
    const key = this.getKey(cid, path);

    // Map HPACK headers to R2 httpMetadata format
    const httpMetadata: R2HTTPMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const sanitizedValue = this.sanitizeHeaderValue(value);

      if (!sanitizedValue) {
        console.warn(`Skipping invalid header value for ${key}`);
        continue;
      }

      if (lowerKey === 'content-type') {
        httpMetadata.contentType = sanitizedValue;
      } else if (lowerKey === 'content-encoding') {
        httpMetadata.contentEncoding = sanitizedValue;
      } else if (lowerKey === 'content-language') {
        httpMetadata.contentLanguage = sanitizedValue;
      } else if (lowerKey === 'content-disposition') {
        httpMetadata.contentDisposition = sanitizedValue;
      } else if (lowerKey === 'cache-control') {
        httpMetadata.cacheControl = sanitizedValue;
      } else if (lowerKey === 'expires') {
        try {
          httpMetadata.cacheExpiry = new Date(sanitizedValue);
        } catch (e) {
          console.warn(`Invalid date for expires header: ${sanitizedValue}`);
        }
      }
    }

    await this.bucket.put(key, content, {
      httpMetadata,
    });
  }

  private sanitizeHeaderValue(value: string): string {
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

  async getMetadata(cid: string, path?: string): Promise<R2HTTPMetadata | null> {
    const key = this.getKey(cid, path);
    const obj = await this.bucket.head(key);
    if (!obj) {
      return null;
    }
    return obj.httpMetadata || {};
  }
}
