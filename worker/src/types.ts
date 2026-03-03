import type { R2Bucket, DurableObjectNamespace, D1Database } from '@cloudflare/workers-types';

// =============================================================================
// User & Auth Types
// =============================================================================

/**
 * User roles as bitflags - can be combined
 * Example: Admin + Creator = 1 + 4 = 5
 */
export const UserRole = {
  NONE: 0,
  ADMIN: 1,
  MODERATOR: 2,
  CREATOR: 4,
} as const;

export type UserRoleValue = typeof UserRole[keyof typeof UserRole];

export interface User {
  id: string;
  address: string;
  publicKey: string | null;
  roles: number;
  createdAt: string;
  lastLogin: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthNonce {
  id: string;
  publicKey: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
}

export interface DbSession {
  id: string;
  userId: string | null;
  cid: string | null;
  createdAt: string;
  lastAccessed: string | null;
  name: string | null;
  description: string | null;
  isPublic: boolean;
}

export interface AuthSession {
  user: User | null;
  nonce?: {
    publicKey: string;
    nonce: string;
  };
}

// =============================================================================
// Session & Upload Types
// =============================================================================

export interface UploadStatus {
  state: 'idle' | 'processing' | 'complete' | 'error';
  startedAt?: number;
  completedAt?: number;
  cid?: string;
  fileCount?: number;
  error?: string;
}

export interface RenderJobResult {
  fullResKey: string;
  thumbnailKey: string;
  mime: string;
  fullResolution?: { x: number; y: number };
  thumbnailResolution?: { x: number; y: number };
  dataUrl?: string;
  features?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
  featuresKey?: string;
  metadata?: {
    hash?: string;
    iteration?: number;
    hasAnimation?: boolean;
    animationFrameCount?: number;
  };
}

export interface RenderJobStatus {
  state: 'pending' | 'processing' | 'complete' | 'error';
  requestedAt?: number;
  completedAt?: number;
  error?: string;
  seed?: string;
  useGpu?: boolean;
  params?: Record<string, unknown> | null;
  result?: RenderJobResult;
}

export interface RenderJobResultPayload {
  state: RenderJobStatus['state'];
  completedAt?: number;
  error?: string;
  result?: RenderJobResult;
}

export interface SessionFile {
  path: string;
  size: number;
}

export interface SessionMeta {
  createdAt: number;
  files: SessionFile[];
  defaultEntry: string | null;
  archiveEntryPath?: string | null;
  upload?: UploadStatus;
  cid?: string | null;
  renders: Record<string, RenderJobStatus>;
}

export interface SessionInitResponse {
  defaultEntry: string | null;
  fileCount: number;
  cid: string | null;
  upload: UploadStatus;
}

export interface RenderJobCreatePayload {
  jobId: string;
  seed: string;
  useGpu?: boolean;
  params?: Record<string, unknown> | null;
}

export type CaptureMode = 'auto' | 'trigger';
export type CaptureTarget = 'auto' | 'viewport';

export interface CaptureConfig {
  mode?: CaptureMode;
  viewPortDimension?: { width: number; height: number };
  delayMs?: number;
  target?: CaptureTarget;
  selector?: string;
}

export interface AnimationConfig {
  duration?: number;
  fps?: number;
}

export type ParamPrimitiveType = 'boolean' | 'integer' | 'number' | 'string';
export type ParamCompositeType = 'array' | 'object';
export type ParamType = ParamPrimitiveType | ParamCompositeType;

export interface ParamUi {
  widget?: 'checkbox' | 'slider' | 'dropdown' | 'color' | 'text' | 'textarea';
}

export interface ParamBase<TType extends ParamType = ParamType> {
  id: string;
  type: TType;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  enumLabels?: string[];
  ui?: ParamUi;
}

export interface ParamBoolean extends ParamBase<'boolean'> {
  default?: boolean;
}

export interface ParamInteger extends ParamBase<'integer'> {
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface ParamNumber extends ParamBase<'number'> {
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface ParamString extends ParamBase<'string'> {
  default?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'color' | 'url' | 'textarea';
}

export type ParamPrimitiveDefinition =
  | ParamBoolean
  | ParamInteger
  | ParamNumber
  | ParamString;

export interface ParamArray extends ParamBase<'array'> {
  items: ParamPrimitiveDefinition;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  default?: unknown[];
}

export interface ParamObject extends ParamBase<'object'> {
  properties?: Record<string, ParamPrimitiveDefinition>;
  required?: string[];
  default?: Record<string, unknown>;
}

export type ParamDefinition =
  | ParamPrimitiveDefinition
  | ParamArray
  | ParamObject;

export interface ParametersConfig {
  schema?: ParamDefinition[];
}

export interface BootloaderManifest {
  spec: string;
  entry?: string;
  capture?: CaptureConfig;
  animation?: AnimationConfig;
  parameters?: ParametersConfig;
}

export interface Bindings {
  // D1 Database
  DB: D1Database;
  // Durable Objects
  SESSIONS: DurableObjectNamespace;
  RENDO: DurableObjectNamespace;
  // R2 Buckets
  R2_THUMBS: R2Bucket;
  R2_SANDBOX: R2Bucket;
  // Static assets (frontend build)
  ASSETS: Fetcher;
  // Environment variables
  ENVIRONMENT?: string;
  WORKER_NETWORK?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  SO_ACCESS_KEY?: string;
  WORKER_URL?: string;
  AUTH_TOKEN_SECRET?: string;
  AUTH_TOKEN_TTL_SECONDS?: string;
  FILEBASE_ACCESS_KEY?: string;
  FILEBASE_SECRET_KEY?: string;
  FILEBASE_BUCKET?: string;
  FILEBASE_ENDPOINT?: string;
  INDEXER_ENABLED?: string;
  INDEXER_DRY_RUN?: string;
  INDEXER_PRIVATE_KEY?: string;
  INDEXER_WORKER_BASE_URL?: string;
  INDEXER_TZKT_API?: string;
  INDEXER_RPC_URL?: string;
  INDEXER_GENERIC_WEB_CONTRACT?: string;
  INDEXER_LIMIT?: string;
  INDEXER_SLEEP_MS?: string;
  INDEXER_OPERATION_BATCH_SIZE?: string;
  INDEXER_ATTRIBUTE_RETRIES?: string;
  INDEXER_ATTRIBUTE_RETRY_DELAY_MS?: string;
  INDEXER_CONFIRMATIONS?: string;
}
