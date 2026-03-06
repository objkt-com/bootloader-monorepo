import {
  Bindings,
  RenderJobResultPayload,
  RenderJobStatus,
  SessionMeta,
  UploadStatus,
} from './types';
import { guessContentType, decodeBase64, buildDirectoryCar } from './utils';
import { isFilebaseConfigured, uploadCarToFilebase } from './filebase';
import JSZip from 'jszip';
import {
  detectArchiveRootPrefix,
  normalizeArchivePath,
  parseBootWebManifestBytes,
  stripArchivePrefix,
} from '../../shared/bootloaders/boot-web';

const ARCHIVE_R2_KEY_PREFIX = 'archives/';
const META_KEY = 'meta';
const MAX_RENDER_HISTORY = 50;
const MAX_CONCURRENT_RENDER_JOBS = 5;
const MAX_RENDER_REQUESTS_PER_MINUTE = 10;
const RENDER_RATE_WINDOW_MS = 60_000;
const MB = 1024 * 1024;
const MAX_ARCHIVE_SIZE_BYTES = 50 * MB;
const MAX_FILES_PER_ARCHIVE = 2000;
const MAX_TOTAL_FILE_BYTES = 80 * MB;

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

function assertFilebaseAvailableForPublicIpfs(env: Bindings): void {
  const envName = (env.ENVIRONMENT || '').trim().toLowerCase();
  const requiresPublicIpfs = envName === 'staging' || envName === 'production';
  if (requiresPublicIpfs && !isFilebaseConfigured(env)) {
    throw new Error(
      'Filebase is required for artifact uploads in this environment. Configure FILEBASE_ACCESS_KEY, FILEBASE_SECRET_KEY, and FILEBASE_BUCKET.'
    );
  }
}

export class SessionDurableObject {
  private metaCache: SessionMeta | null = null;
  private updateLock: Promise<void> = Promise.resolve();
  private state: DurableObjectState;
  private env: Bindings;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;
  }

  private async getMeta(): Promise<SessionMeta | null> {
    if (this.metaCache) {
      return JSON.parse(JSON.stringify(this.metaCache));
    }
    const stored = await this.state.storage.get(META_KEY);
    this.metaCache = (stored as SessionMeta | null | undefined) ?? null;
    return this.metaCache ? JSON.parse(JSON.stringify(this.metaCache)) : null;
  }

  private async putMeta(meta: SessionMeta): Promise<void> {
    this.metaCache = JSON.parse(JSON.stringify(meta));
    await this.state.storage.put(META_KEY, meta);
  }

  private async listFiles(): Promise<SessionMeta['files']> {
    const meta = await this.getMeta();
    return meta?.files ?? [];
  }

  private async performUpload(meta: SessionMeta): Promise<UploadStatus> {
    const files = await this.listFiles();
    if (!files.length) throw new Error('No files to upload');

    meta.upload = {
      state: 'processing',
      startedAt: Date.now(),
    };
    await this.putMeta(meta);

    try {
      const payloads: { path: string; content: Uint8Array }[] = [];
      for (const file of files) {
        // Files are now stored in R2, not DO storage
        const key = `${meta.cid}/${file.path}`;
        const object = await this.env.R2_SANDBOX.get(key);
        if (!object) {
          console.warn('[session-do] missing file during upload', file.path);
          continue;
        }
        const buffer = await object.arrayBuffer();
        payloads.push({ path: file.path, content: new Uint8Array(buffer) });
      }
      console.log('[session-do] uploading files to R2', payloads.map(p => p.path));

      if (!payloads.length) throw new Error('No files to upload');

      const { cid: localCid, car } = await buildDirectoryCar(payloads);
      let cid = localCid;

      assertFilebaseAvailableForPublicIpfs(this.env);
      if (isFilebaseConfigured(this.env)) {
        const uploaded = await uploadCarToFilebase(this.env, localCid, car);
        cid = uploaded.cid;
      }

      for (const file of payloads) {
        const key = `${cid}/${file.path}`;
        await this.env.R2_SANDBOX.put(key, file.content, {
          httpMetadata: {
            contentType: guessContentType(file.path),
            cacheControl: 'public, max-age=31536000, immutable',
          },
          customMetadata: { session: this.state.id.toString() },
        });
      }

      meta.cid = cid;
      meta.upload = {
        state: 'complete',
        startedAt: meta.upload.startedAt,
        completedAt: Date.now(),
        cid,
        fileCount: payloads.length,
      };
      await this.putMeta(meta);
      return meta.upload;
    } catch (error) {
      meta.cid = null;
      meta.upload = {
        state: 'error',
        startedAt: meta.upload?.startedAt,
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };
      await this.putMeta(meta);
      throw error;
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'POST' && pathname === '/init') {
      return this.handleInit(request);
    }

    if (request.method === 'GET' && pathname === '/meta') {
      return this.handleGetMeta();
    }

    if (request.method === 'GET' && pathname.startsWith('/files/')) {
      const path = decodeURIComponent(pathname.slice('/files/'.length));
      return this.handleGetFile(path);
    }

    if (request.method === 'POST' && pathname === '/upload') {
      return this.handleUpload();
    }

    if (request.method === 'GET' && pathname === '/upload/status') {
      return this.handleUploadStatus();
    }

    if (request.method === 'GET' && pathname === '/archive') {
      return this.handleArchive();
    }

    if (request.method === 'POST' && pathname === '/render-jobs') {
      return this.handleCreateRenderJob(request);
    }

    if (pathname.startsWith('/render-jobs/')) {
      const jobId = pathname.slice('/render-jobs/'.length);
      if (!jobId) return new Response('Missing job', { status: 400 });
      if (request.method === 'GET') {
        return this.handleGetRenderJob(jobId);
      }
      if (request.method === 'PUT') {
        return this.handleUpdateRenderJob(jobId, request);
      }
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleInit(request: Request): Promise<Response> {
    try {
      const contentType = request.headers.get('content-type') || '';
      const payloads: { path: string; content: Uint8Array }[] = [];
      const files: SessionMeta['files'] = [];
      let archive: Uint8Array;
      let rootPrefix: string | null = null;
      let totalFileBytes = 0;

      if (contentType.includes('application/json')) {
        const payload = (await request.json()) as {
          archiveBase64?: string;
          files?: { path: string; contentBase64: string }[];
          rootPrefix?: string | null;
        };
        const filesPayload = Array.isArray(payload?.files) ? payload.files : [];
        const archiveBase64 = payload?.archiveBase64;
        rootPrefix = typeof payload?.rootPrefix === 'string' && payload.rootPrefix.length > 0 ? payload.rootPrefix : null;

        if (!filesPayload.length || !archiveBase64) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (filesPayload.length > MAX_FILES_PER_ARCHIVE) {
          return new Response(
            JSON.stringify({ error: `Archive has too many files (${filesPayload.length}). Max ${MAX_FILES_PER_ARCHIVE}.` }),
            {
              status: 413,
              headers: { 'content-type': 'application/json' },
            }
          );
        }

        archive = decodeBase64(archiveBase64);

        for (const entry of filesPayload) {
          const normalized = normalizeArchivePath(entry.path);
          if (!normalized || normalized.length === 0) continue;
          const content = decodeBase64(entry.contentBase64);

          totalFileBytes += content.length;
          if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
            return new Response(
              JSON.stringify({
                error: `Uncompressed project size exceeds limit (${formatMb(totalFileBytes)} > ${formatMb(MAX_TOTAL_FILE_BYTES)}).`,
              }),
              {
                status: 413,
                headers: { 'content-type': 'application/json' },
              }
            );
          }

          payloads.push({ path: normalized, content });
          files.push({ path: normalized, size: content.length });
        }
      } else {
        const archiveBuffer = new Uint8Array(await request.arrayBuffer());
        archive = archiveBuffer;

        const zip = await JSZip.loadAsync(archiveBuffer);
        const entries = Object.entries(zip.files).filter(([path, entry]) => !entry.dir && !path.startsWith('__MACOSX/'));

        if (!entries.length) {
          return new Response(JSON.stringify({ error: 'Archive contains no files' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (entries.length > MAX_FILES_PER_ARCHIVE) {
          return new Response(
            JSON.stringify({ error: `Archive has too many files (${entries.length}). Max ${MAX_FILES_PER_ARCHIVE}.` }),
            {
              status: 413,
              headers: { 'content-type': 'application/json' },
            }
          );
        }

        for (const [rawPath, entry] of entries) {
          const normalized = normalizeArchivePath(rawPath.replace(/\\/g, '/'));
          if (!normalized || normalized.length === 0) continue;
          const content = await entry.async('uint8array');

          totalFileBytes += content.length;
          if (totalFileBytes > MAX_TOTAL_FILE_BYTES) {
            return new Response(
              JSON.stringify({
                error: `Uncompressed project size exceeds limit (${formatMb(totalFileBytes)} > ${formatMb(MAX_TOTAL_FILE_BYTES)}).`,
              }),
              {
                status: 413,
                headers: { 'content-type': 'application/json' },
              }
            );
          }

          payloads.push({ path: normalized, content });
          files.push({ path: normalized, size: content.length });
        }
      }

      if (archive.length > MAX_ARCHIVE_SIZE_BYTES) {
        return new Response(
          JSON.stringify({
            error: `Archive exceeds upload limit (${formatMb(archive.length)} > ${formatMb(MAX_ARCHIVE_SIZE_BYTES)}).`,
          }),
          {
            status: 413,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      if (!files.length || !payloads.length) {
        return new Response(JSON.stringify({ error: 'No files provided' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }

      // Detect and strip wrapper folder before CID/CAR generation so on-chain artifact CID is the unwrapped project root.
      const effectivePrefix = detectArchiveRootPrefix(
        payloads.map((entry) => entry.path),
        rootPrefix
      );
      if (effectivePrefix) {
        console.log('[session-do] stripped wrapped root prefix:', effectivePrefix);
      }

      const storagePayloads = payloads.map((entry) => ({
        path: stripArchivePrefix(entry.path, effectivePrefix),
        content: entry.content,
      }));
      const storageFiles = files.map((entry) => ({
        path: stripArchivePrefix(entry.path, effectivePrefix),
        size: entry.size,
      }));

      const hasIndexHtml = storageFiles.some((entry) => entry.path === 'index.html');
      if (!hasIndexHtml) {
        throw new Error('Archive must include index.html at the project root');
      }

      const manifestEntry = storagePayloads.find((entry) => entry.path === 'manifest.json');
      if (manifestEntry) {
        parseBootWebManifestBytes(manifestEntry.content);
      }

      const defaultEntry = 'index.html';

      // Build a deterministic directory CAR so we can publish to Filebase and keep a stable CID.
      const { cid: localCid, car } = await buildDirectoryCar(storagePayloads);
      let cid = localCid;
      console.log('[session-do] calculated CID:', localCid);

      assertFilebaseAvailableForPublicIpfs(this.env);
      if (isFilebaseConfigured(this.env)) {
        const uploaded = await uploadCarToFilebase(this.env, localCid, car);
        cid = uploaded.cid;
        console.log('[session-do] uploaded CAR to Filebase', { localCid, filebaseCid: cid, key: uploaded.key });
      }

      // Upload all files directly to R2
      console.log('[session-do] uploading files to R2', storagePayloads.map((p) => p.path), { effectivePrefix });
      for (const file of storagePayloads) {
        const key = `${cid}/${file.path}`;
        await this.env.R2_SANDBOX.put(key, file.content, {
          httpMetadata: {
            contentType: guessContentType(file.path),
            cacheControl: 'public, max-age=31536000, immutable',
          },
          customMetadata: { session: this.state.id.toString() },
        });
      }

      // Upload archive to R2 using CID
      const archiveR2Key = `${ARCHIVE_R2_KEY_PREFIX}${cid}.zip`;
      await this.env.R2_SANDBOX.put(archiveR2Key, archive, {
        httpMetadata: {
          contentType: 'application/zip',
        },
      });

      // archiveEntryPath is for extracting from the original zip (keeps prefix)
      const archiveEntryPath = effectivePrefix ? `${effectivePrefix}/index.html` : 'index.html';

      const meta: SessionMeta = {
        createdAt: Date.now(),
        files: storageFiles,
        defaultEntry,
        archiveEntryPath,
        upload: { state: 'complete', startedAt: Date.now(), completedAt: Date.now(), cid, fileCount: storageFiles.length },
        cid,
        renders: {},
      };
      await this.putMeta(meta);

      const latestMeta = await this.getMeta();
      return new Response(
        JSON.stringify({
          defaultEntry,
          fileCount: storageFiles.length,
          cid: latestMeta?.cid ?? null,
          upload: latestMeta?.upload ?? { state: 'idle' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('[session-do] init failed', this.state.id.toString(), error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to read archive' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  }

  private async handleGetMeta(): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta) {
      return new Response('Not initialized', { status: 404 });
    }
    return new Response(JSON.stringify(meta), {
      headers: { 'content-type': 'application/json' },
    });
  }

  private async handleGetFile(path: string): Promise<Response> {
    const normalized = normalizeArchivePath(path ?? '');
    if (!normalized) return new Response('Invalid path', { status: 400 });

    const meta = await this.getMeta();
    if (!meta || !meta.cid) return new Response('File not found', { status: 404 });

    // Fetch file from R2
    const key = `${meta.cid}/${normalized}`;
    const object = await this.env.R2_SANDBOX.get(key);
    if (!object) return new Response('File not found', { status: 404 });

    const headers = new Headers();
    headers.set('content-type', guessContentType(normalized));
    return new Response(object.body, { headers });
  }

  private async handleArchive(): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta || !meta.cid) return new Response('Archive not found', { status: 404 });

    // Fetch archive from R2 using CID
    const archiveR2Key = `${ARCHIVE_R2_KEY_PREFIX}${meta.cid}.zip`;
    const object = await this.env.R2_SANDBOX.get(archiveR2Key);
    if (!object) return new Response('Archive not found', { status: 404 });

    return new Response(object.body, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="project.zip"',
      },
    });
  }

  private async handleUpload(): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta) return new Response('Not initialized', { status: 404 });
    try {
      const upload = await this.performUpload(meta);
      return new Response(JSON.stringify(upload), {
        headers: { 'content-type': 'application/json' },
      });
    } catch (error) {
      const metaAfter = await this.getMeta();
      return new Response(
        JSON.stringify(metaAfter?.upload ?? { state: 'error', error: 'Upload failed' }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  }

  private async handleUploadStatus(): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta) return new Response('Not initialized', { status: 404 });
    return new Response(JSON.stringify(meta.upload ?? { state: 'idle' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  private async handleCreateRenderJob(request: Request): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta) return new Response('Not initialized', { status: 404 });

    const payload = await request.json();
    const { jobId, seed, useGpu, params } = payload as {
      jobId: string;
      seed: string;
      useGpu?: boolean;
      params?: Record<string, unknown> | null;
    };
    if (!jobId || !seed) {
      return new Response('Missing parameters', { status: 400 });
    }

    const now = Date.now();
    const renderJobs = meta.renders ?? {};
    const existingJobs = Object.values(renderJobs);
    const activeJobCount = existingJobs.filter(
      (job) => job.state === 'pending' || job.state === 'processing'
    ).length;
    if (activeJobCount >= MAX_CONCURRENT_RENDER_JOBS) {
      return new Response(
        JSON.stringify({
          error: `Render queue is full (${MAX_CONCURRENT_RENDER_JOBS} max in-flight). Please wait for current renders to finish.`,
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '5',
          },
        }
      );
    }

    const windowStart = now - RENDER_RATE_WINDOW_MS;
    const recentRequestTimestamps = existingJobs
      .map((job) => job.requestedAt ?? 0)
      .filter((requestedAt) => requestedAt > windowStart);
    if (recentRequestTimestamps.length >= MAX_RENDER_REQUESTS_PER_MINUTE) {
      const oldestRecentRequest = Math.min(...recentRequestTimestamps);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((RENDER_RATE_WINDOW_MS - (now - oldestRecentRequest)) / 1000)
      );

      return new Response(
        JSON.stringify({
          error: `Render rate limit exceeded (${MAX_RENDER_REQUESTS_PER_MINUTE} per minute). Please retry shortly.`,
        }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(retryAfterSeconds),
          },
        }
      );
    }

    renderJobs[jobId] = {
      state: 'pending',
      requestedAt: now,
      seed,
      useGpu: !!useGpu,
      params: params ?? null,
    };

    meta.renders = this.pruneRenderHistory(renderJobs);
    console.log('[session-do] create render job', this.state.id.toString(), jobId, Object.keys(meta.renders));
    await this.putMeta(meta);

    return new Response(JSON.stringify(renderJobs[jobId]), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }

  private pruneRenderHistory(renders: SessionMeta['renders']): SessionMeta['renders'] {
    const entries = Object.entries(renders);

    // Never prune jobs that are still processing
    const processing = entries.filter(([_, job]) => job.state === 'processing');
    const completed = entries.filter(([_, job]) => job.state !== 'processing');

    // Sort completed by requestedAt (most recent first)
    completed.sort((a, b) => {
      const tA = a[1].requestedAt ?? 0;
      const tB = b[1].requestedAt ?? 0;
      return tB - tA;
    });

    // Keep all processing jobs + up to MAX_RENDER_HISTORY completed jobs
    const toKeep = [...processing, ...completed.slice(0, MAX_RENDER_HISTORY)];
    return Object.fromEntries(toKeep);
  }

  private async handleGetRenderJob(jobId: string): Promise<Response> {
    const meta = await this.getMeta();
    if (!meta) return new Response('Not initialized', { status: 404 });
    const job = meta.renders?.[jobId];
    if (!job) {
      console.log('[session-do] get render job miss', this.state.id.toString(), jobId, Object.keys(meta.renders ?? {}));
      return new Response('Unknown job', { status: 404 });
    }
    console.log('[session-do] get render job hit', this.state.id.toString(), jobId, job.state);
    return new Response(JSON.stringify(job), {
      headers: { 'content-type': 'application/json' },
    });
  }

  private async handleUpdateRenderJob(jobId: string, request: Request): Promise<Response> {
    const payload = (await request.json()) as RenderJobResultPayload;

    // Serialize all updates through a lock to prevent race conditions
    let updatedJob: RenderJobStatus | null = null;

    this.updateLock = this.updateLock.then(async () => {
      // Always read fresh from storage
      const stored = await this.state.storage.get(META_KEY);
      const meta = (stored as SessionMeta | null | undefined) ?? null;
      if (!meta) throw new Error('Not initialized');
      const job = meta.renders?.[jobId];
      if (!job) throw new Error('Unknown job');

      // Mutate directly
      meta.renders[jobId] = {
        ...job,
        state: payload.state,
        completedAt: payload.completedAt,
        error: payload.error,
        result: payload.result,
      };
      console.log('[session-do] update render job', this.state.id.toString(), jobId, meta.renders[jobId].state);

      // Write to storage and update cache atomically
      await this.state.storage.put(META_KEY, meta);
      this.metaCache = JSON.parse(JSON.stringify(meta));

      updatedJob = meta.renders[jobId];
    }).catch((error) => {
      console.error('[session-do] update render job failed', this.state.id.toString(), jobId, error);
      throw error;
    });

    await this.updateLock;
    const result = updatedJob ?? null;

    if (!result) {
      return new Response('Unknown job', { status: 404 });
    }

    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  }
}
