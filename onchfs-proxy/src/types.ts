export interface NetworkConfig {
  name: string;
  tzktBaseUrl: string;
  inodesBigmapId: number;
  contentStoreBigmapId: number;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    tzktBaseUrl: 'https://api.tzkt.io/v1',
    inodesBigmapId: 549145,
    contentStoreBigmapId: 549144,
  },
  ghostnet: {
    name: 'ghostnet',
    tzktBaseUrl: 'https://api.ghostnet.tzkt.io/v1',
    inodesBigmapId: 361363,
    contentStoreBigmapId: 354463,
  },
  shadownet: {
    name: 'shadownet',
    tzktBaseUrl: 'https://api.shadownet.tzkt.io/v1',
    inodesBigmapId: 33,
    contentStoreBigmapId: 32,
  },
};

export interface FileChunk {
  bytes: string; // hex string
  hash: string; // hex string
}

export interface FileInode {
  type: 'file';
  cid: string;
  chunkPointers: string[];
  metadata?: string; // hex string
}

export interface DirectoryInode {
  type: 'directory';
  cid: string;
  files: Record<string, string>; // filename -> child CID
}

export type INode = FileInode | DirectoryInode;

export interface BigMapKeyResponse {
  key: string;
  value: any;
}

export interface Env {
  ONCHFS_BUCKET: R2Bucket;
  ONCHFS_SYNC: DurableObjectNamespace;
}
