import type { BootloaderId, BootloaderManifest } from './bootloader'

export interface Generator {
  /** Unique identifier (on-chain ID) */
  id: string
  /** Display name */
  name: string
  /** Creator wallet address */
  creator: string
  /** Creator display name (resolved) */
  creatorName?: string
  /** Associated bootloader */
  bootloaderId: BootloaderId
  /** For svg-js: inline JavaScript code */
  code?: string
  /** For generic-web: IPFS CID of the project */
  cid?: string
  /** Manifest for generic-web bootloader */
  manifest?: BootloaderManifest
  /** Thumbnail URL */
  thumbnailUrl?: string
  /** Description */
  description?: string
  /** Creation timestamp */
  createdAt?: string
  /** Last updated timestamp */
  updatedAt?: string
  /** Version number (increments on updates) */
  version?: number
  /** Total supply (editions minted) */
  supply?: number
  /** Maximum editions (0 = unlimited) */
  maxSupply?: number
  /** Price in mutez */
  price?: number
  /** Whether minting is currently open */
  mintingOpen?: boolean
  /** Sale start time */
  saleStartTime?: string
  /** Tags for filtering */
  tags?: string[]
  /** Whether this generator is flagged */
  flagged?: boolean
  /** Flag reason code */
  flagReason?: number
  /** Block level when generator was first created (for sorting across contracts) */
  firstLevel?: number
}

export interface Token {
  /** Token ID */
  id: string
  /** Generator this token belongs to */
  generatorId: string
  /** Bootloader ID (for routing) */
  bootloaderId: BootloaderId
  /** Generator data (populated) */
  generator?: Generator
  /** Owner wallet address */
  owner: string
  /** Owner display name (resolved) */
  ownerName?: string
  /** Seed used for this token */
  seed: string
  /** Iteration number */
  iteration: number
  /** Generator version at time of mint */
  version?: number
  /** Parameter values (for generic-web) */
  params?: Record<string, unknown>
  /** Mint timestamp */
  mintedAt?: string
  /** Thumbnail URL */
  thumbnailUrl?: string
  /** Artifact URI (on-chain) - contains the actual SVG/content for this specific token */
  artifactUri?: string
  /** For generic-web: IPFS CID of the project archive for this specific token version */
  artifactCid?: string
  /** Display URI */
  displayUri?: string
  /** For SVG-JS tokens: the code used at time of mint (extracted from artifactUri) */
  code?: string
}

export interface MintConfig {
  /** Price in mutez */
  price: number
  /** Maximum supply (0 = unlimited) */
  maxSupply: number
  /** Sale start time (ISO string) */
  startTime?: string
  /** Whether minting is enabled */
  enabled: boolean
}

export interface GeneratorListParams {
  /** Filter by bootloader */
  bootloaderId?: BootloaderId
  /** Filter by creator address */
  creator?: string
  /** Filter by mint status */
  mintStatus?: 'open' | 'closed' | 'upcoming' | 'sold-out'
  /** Search query */
  search?: string
  /** Sort field */
  sortBy?: 'created' | 'updated' | 'supply' | 'price'
  /** Sort direction */
  sortDir?: 'asc' | 'desc'
  /** Pagination offset */
  offset?: number
  /** Pagination limit */
  limit?: number
}

export interface TokenListParams {
  /** Filter by generator */
  generatorId?: string
  /** Filter by owner address */
  owner?: string
  /** Sort field */
  sortBy?: 'minted' | 'iteration'
  /** Sort direction */
  sortDir?: 'asc' | 'desc'
  /** Pagination offset */
  offset?: number
  /** Pagination limit */
  limit?: number
}
