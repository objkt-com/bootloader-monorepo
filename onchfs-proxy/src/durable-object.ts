import { Env, FileInode } from './types';
import { OnchFSResolver } from './resolver';
import { R2Storage } from './storage';
import { NETWORKS } from './types';
import { decodeHpack } from './lib/hpack-decompressor';

interface FetchRequest {
  network: string;
  cid: string;
  path?: string;
}

export class OnchFSSyncObject {
  private state: DurableObjectState;
  private env: Env;
  private inProgress: Map<string, Promise<Response>>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.inProgress = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const { network, cid, path } = (await request.json()) as FetchRequest;

    // Create unique key for this request
    const requestKey = `${network}:${cid}:${path || ''}`;

    // Check if already in progress
    if (this.inProgress.has(requestKey)) {
      // Wait for the existing request to complete
      return await this.inProgress.get(requestKey)!;
    }

    // Start new fetch
    const fetchPromise = this.fetchFromChain(network, cid, path);
    this.inProgress.set(requestKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      // Clean up
      this.inProgress.delete(requestKey);
    }
  }

  private async fetchFromChain(network: string, cid: string, path?: string): Promise<Response> {
    const config = NETWORKS[network];
    if (!config) {
      return new Response('Invalid network', { status: 400 });
    }

    const resolver = new OnchFSResolver(config);
    const storage = new R2Storage(this.env.ONCHFS_BUCKET, network);

    // Resolve the inode
    const inode = await resolver.resolveInode(cid);
    if (!inode) {
      return new Response('Not found', { status: 404 });
    }

    // Resolve the target file inode
    let fileInode: FileInode;
    let storagePath: string | undefined = path;

    if (inode.type === 'directory') {
      // If no path specified, default to index.html
      const targetPath = path || 'index.html';

      // Navigate to the file in the directory
      const resolvedInode = await this.resolvePathInDirectory(resolver, inode, targetPath);
      if (!resolvedInode) {
        const errorMsg = !path
          ? 'No index.html found in directory'
          : 'File not found in directory';
        return new Response(errorMsg, { status: 404 });
      }

      fileInode = resolvedInode;
      storagePath = targetPath;
    } else {
      // It's a file inode
      fileInode = inode;
    }

    // Fetch, decompress, and store the file
    let content = await resolver.getFileContent(fileInode);
    const metadata = this.parseMetadata(fileInode.metadata);

    // Decompress if needed
    content = await this.decompressIfNeeded(content, metadata);

    // Store in R2
    await storage.putFile(cid, content, metadata, storagePath);

    return new Response(JSON.stringify({ success: true, metadata }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async resolvePathInDirectory(
    resolver: OnchFSResolver,
    dirInode: any,
    path: string
  ): Promise<FileInode | null> {
    const parts = path.split('/').filter((p) => p);
    let current: any = dirInode;

    for (const part of parts) {
      if (current.type !== 'directory') {
        return null;
      }

      const childCid = current.files[part];
      if (!childCid) {
        return null;
      }

      current = await resolver.resolveInode(childCid);
      if (!current) {
        return null;
      }
    }

    if (current.type !== 'file') {
      return null;
    }

    return current as FileInode;
  }

  private parseMetadata(metadataHex?: string): Record<string, string> {
    if (!metadataHex) {
      return {};
    }

    try {
      const bytes = this.hexToBytes(metadataHex);
      return decodeHpack(bytes);
    } catch (e) {
      // If HPACK decoding fails, return empty headers
      return {};
    }
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private async decompressIfNeeded(
    content: Uint8Array,
    metadata: Record<string, string>
  ): Promise<Uint8Array> {
    // If content is gzipped, decompress it before storing
    if (metadata['content-encoding'] === 'gzip') {
      try {
        const decompressed = new Response(content).body?.pipeThrough(
          new DecompressionStream('gzip')
        );

        if (decompressed) {
          const reader = decompressed.getReader();
          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }

          // Concatenate all chunks
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const result = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }

          // Remove content-encoding from metadata since we're storing uncompressed
          delete metadata['content-encoding'];
          return result;
        }
      } catch (e) {
        // If decompression fails, return original content
      }
    }

    return content;
  }
}
