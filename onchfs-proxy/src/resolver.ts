import { TzKTClient } from './tzkt';
import { NetworkConfig, FileInode, DirectoryInode, INode } from './types';

export class OnchFSResolver {
  private tzkt: TzKTClient;

  constructor(private config: NetworkConfig) {
    this.tzkt = new TzKTClient(config);
  }

  async resolveInode(cidHex: string): Promise<INode | null> {
    // BFS to collect all inodes
    const toVisit: string[] = [cidHex];
    const inodeResults: Record<string, any> = {};
    const allFileChunks: string[] = [];

    while (toVisit.length > 0) {
      // Bulk read current batch
      const batch = await this.tzkt.getBigMapKeys(this.config.inodesBigmapId, toVisit);
      toVisit.length = 0;

      for (const entry of batch) {
        const cid = entry.key;
        const value = entry.value;

        if (value.directory) {
          // It's a directory inode
          const dirMap = value.directory;
          inodeResults[cid] = { type: 'directory', files: dirMap };
          // Add child CIDs to visit queue
          toVisit.push(...(Object.values(dirMap) as string[]));
        } else if (value.file) {
          // It's a file inode
          const file = value.file;
          inodeResults[cid] = {
            type: 'file',
            chunkPointers: file.chunk_pointers || [],
            metadata: file.metadata,
          };
          allFileChunks.push(...(file.chunk_pointers || []));
        }
      }
    }

    // Check if root CID was found
    if (!inodeResults[cidHex]) {
      return null;
    }

    // Bulk fetch all file chunks
    const chunkResults: Record<string, string> = {};
    if (allFileChunks.length > 0) {
      const chunkEntries = await this.tzkt.getBigMapKeys(
        this.config.contentStoreBigmapId,
        allFileChunks
      );
      for (const item of chunkEntries) {
        chunkResults[item.key] = item.value;
      }
    }

    // Build inode objects
    const inodeObjs: Record<string, INode> = {};

    // Build file inodes first
    for (const [cid, raw] of Object.entries(inodeResults)) {
      if (raw.type === 'file') {
        inodeObjs[cid] = {
          type: 'file',
          cid,
          chunkPointers: raw.chunkPointers,
          metadata: raw.metadata,
        } as FileInode;
      }
    }

    // Build directory inodes
    for (const [cid, raw] of Object.entries(inodeResults)) {
      if (raw.type === 'directory') {
        inodeObjs[cid] = {
          type: 'directory',
          cid,
          files: raw.files,
        } as DirectoryInode;
      }
    }

    return inodeObjs[cidHex] || null;
  }

  async getFileContent(inode: FileInode): Promise<Uint8Array> {
    // Fetch all chunks
    const chunkData = await this.tzkt.getBigMapKeys(
      this.config.contentStoreBigmapId,
      inode.chunkPointers
    );

    const chunkMap: Record<string, any> = {};
    for (const entry of chunkData) {
      chunkMap[entry.key] = entry.value;
    }

    // Concatenate chunks in order
    const chunks: Uint8Array[] = [];
    for (const pointer of inode.chunkPointers) {
      const value = chunkMap[pointer];
      if (value) {
        // TzKT returns hex strings directly for bytes
        const hexData = typeof value === 'string' ? value : value.bytes || value;
        chunks.push(hexToBytes(hexData));
      }
    }

    return concatenateUint8Arrays(chunks);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
