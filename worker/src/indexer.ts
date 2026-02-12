import { GeneratorService, TokenService } from "./services";
import { storeJsonToIpfs } from "./ipfs-json";
import type { Bindings } from "./types";

const GHOSTNET_NETWORK = "ghostnet" as const;
const GHOSTNET_NETWORK_CODE = "g";
const DEFAULT_GHOSTNET_TZKT_API = "https://api.ghostnet.tzkt.io";
const DEFAULT_GHOSTNET_RPC_URL = "https://rpc.ghostnet.teztnets.com";
const DEFAULT_GHOSTNET_GENERIC_WEB_CONTRACT =
  "KT19sQFrMxqqHB7oSNXnTehChqBnkggsaRMw";

interface QueueRowValue {
  generator_id?: unknown;
  generator_version?: unknown;
  iteration_number?: unknown;
  raw_seed?: unknown;
  offchain_metadata_updated?: boolean;
}

interface QueueRow {
  key?: unknown;
  value?: QueueRowValue;
}

interface PendingMetadataUpdate {
  tokenId: number;
  metadataCid: string;
}

interface BigmapPointers {
  tokenExtra: number;
  tokenMetadata: number;
  generators: number;
}

interface IndexerConfig {
  enabled: boolean;
  dryRun: boolean;
  workerBaseUrl: string;
  tzktBase: string;
  rpcUrl: string;
  contract: string;
  privateKey: string;
  limit: number;
  sleepMs: number;
  operationBatchSize: number;
  attributeRetries: number;
  attributeRetryDelayMs: number;
  confirmations: number;
}

export interface IndexerTokenOutcome {
  tokenId: number;
  status: "processed" | "skipped" | "failed";
  reason?: string;
  metadataCid?: string;
  operationHash?: string;
}

export interface IndexerRunSummary {
  source: "cron" | "manual";
  network: "ghostnet";
  dryRun: boolean;
  contract: string;
  queueSize: number;
  processed: number;
  skipped: number;
  failed: number;
  skippedByReason: Record<string, number>;
  outcomes: IndexerTokenOutcome[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RunIndexerOptions {
  source?: "cron" | "manual";
  limit?: number;
  dryRun?: boolean;
  tokenId?: number;
}

export async function runGenericWebMetadataIndexer(
  env: Bindings,
  options: RunIndexerOptions = {}
): Promise<IndexerRunSummary> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const source = options.source ?? "cron";
  const config = loadConfig(env, options);

  const summary: IndexerRunSummary = {
    source,
    network: GHOSTNET_NETWORK,
    dryRun: config.dryRun,
    contract: config.contract,
    queueSize: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    skippedByReason: {},
    outcomes: [],
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
  };

  console.log(
    "[indexer] run start",
    JSON.stringify({
      source,
      dryRun: config.dryRun,
      tokenId: options.tokenId ?? null,
      limit: config.limit,
      operationBatchSize: config.operationBatchSize,
      contract: config.contract,
      tzktBase: config.tzktBase,
      workerBaseUrl: config.workerBaseUrl,
      enabled: config.enabled,
    })
  );

  if (!config.enabled) {
    console.log("[indexer] disabled, skipping run");
    finalizeSummary(summary, started);
    return summary;
  }

  if (!config.workerBaseUrl) {
    throw new Error(
      "Missing WORKER_URL or INDEXER_WORKER_BASE_URL for indexer thumbnail warmup"
    );
  }

  if (!config.dryRun && !config.privateKey) {
    throw new Error(
      "Missing INDEXER_PRIVATE_KEY for indexer transaction signing"
    );
  }

  const pointers = await fetchBigmapPointers(config);
  console.log("[indexer] bigmap pointers", JSON.stringify(pointers));

  const queueRows = await fetchPendingQueue(
    config,
    pointers.tokenExtra,
    options.tokenId
  );
  summary.queueSize = queueRows.length;
  console.log(
    "[indexer] queue rows",
    JSON.stringify({
      size: queueRows.length,
      tokenIds: queueRows
        .slice(0, 50)
        .map((row) => toNat(row.key))
        .filter((id): id is number => id != null),
      tokenScoped: options.tokenId ?? null,
    })
  );

  if (queueRows.length === 0) {
    console.log("[indexer] no pending rows found");
    finalizeSummary(summary, started);
    return summary;
  }

  const tokenService = new TokenService(env.DB);
  const generatorService = new GeneratorService(env.DB);
  const contract = await loadContractIfNeeded(config);
  const pendingMetadataUpdates: PendingMetadataUpdate[] = [];

  for (const row of queueRows) {
    const tokenId = toNat(row.key);
    const queueValue = asRecord(row.value) as QueueRowValue;
    if (tokenId == null) {
      markSkipped(summary, -1, "malformed-token-id");
      continue;
    }

    const generatorId = toNat(queueValue.generator_id);
    const generatorVersion = toNat(queueValue.generator_version) ?? 1;
    const iteration = toNat(queueValue.iteration_number);
    const rawSeed = extractOptionBytes(queueValue.raw_seed);

    console.log(
      "[indexer] processing token",
      JSON.stringify({
        tokenId,
        generatorId,
        generatorVersion,
        hasSeed: Boolean(rawSeed),
        offchainUpdated: Boolean(queueValue.offchain_metadata_updated),
      })
    );

    if (generatorId == null) {
      markSkipped(summary, tokenId, "missing-generator-id");
      continue;
    }
    if (!rawSeed) {
      markSkipped(summary, tokenId, "seed-not-ready");
      continue;
    }

    try {
      const tokenEntry = await fetchBigmapKey(
        config,
        pointers.tokenMetadata,
        tokenId
      );
      const generatorEntry = await fetchBigmapKey(
        config,
        pointers.generators,
        generatorId
      );
      if (!tokenEntry || !generatorEntry) {
        markSkipped(summary, tokenId, "missing-bigmap-rows");
        continue;
      }

      const tokenInfo = asRecord(asRecord(tokenEntry.value).token_info);
      const generatorValue = asRecord(generatorEntry.value);

      const artifactUri = decodeHexToText(
        tokenInfo.artifact_uri ?? tokenInfo._artifact_uri
      );
      if (!artifactUri) {
        markSkipped(summary, tokenId, "artifact-uri-not-ready");
        continue;
      }
      console.log(
        "[indexer] token artifact uri found",
        JSON.stringify({ tokenId, hasArtifactUri: true })
      );

      const existingToken = await tokenService.getToken(
        tokenId,
        GHOSTNET_NETWORK,
        "generic-web"
      );
      if (!existingToken) {
        await tokenService.storeToken({
          id: tokenId,
          generatorId,
          network: GHOSTNET_NETWORK,
          bootloader: "generic-web",
          seed: rawSeed,
          iteration,
        });
        console.log(
          "[indexer] indexed token shell stored",
          JSON.stringify({ tokenId, generatorId, iteration })
        );
      }

      try {
        await triggerFeatureExtraction(config, tokenId, generatorVersion);
        console.log(
          "[indexer] feature extraction warmup completed",
          JSON.stringify({ tokenId, generatorVersion })
        );
      } catch (error) {
        console.warn("[indexer] feature extraction warmup failed", {
          tokenId,
          error,
        });
      }

      const attributes = await pollTokenAttributes(
        config,
        tokenService,
        tokenId
      );
      console.log(
        "[indexer] attributes polled",
        JSON.stringify({ tokenId, count: attributes.length })
      );
      if (attributes.length === 0) {
        markSkipped(summary, tokenId, "attributes-not-ready");
        continue;
      }
      const generatorMeta = await generatorService.getGenerator(
        generatorId,
        GHOSTNET_NETWORK,
        "generic-web"
      );

      const metadataPayload = buildMetadataPayload({
        generatorValue,
        generatorMeta,
        attributes,
      });

      const uploaded = await storeJsonToIpfs(env, metadataPayload, "indexer");
      console.log(
        "[indexer] metadata uploaded",
        JSON.stringify({
          tokenId,
          cid: uploaded.cid,
          backend: uploaded.backend,
          size: uploaded.size,
        })
      );

      if (config.dryRun) {
        summary.processed += 1;
        summary.outcomes.push({
          tokenId,
          status: "processed",
          metadataCid: uploaded.cid,
        });
        console.log(
          "[indexer] dry-run processed token",
          JSON.stringify({ tokenId, metadataCid: uploaded.cid })
        );
      } else {
        pendingMetadataUpdates.push({
          tokenId,
          metadataCid: uploaded.cid,
        });

        if (pendingMetadataUpdates.length >= config.operationBatchSize) {
          const updatesToFlush = pendingMetadataUpdates.splice(
            0,
            pendingMetadataUpdates.length
          );
          await flushPendingMetadataUpdates(
            contract,
            updatesToFlush,
            config.confirmations,
            summary
          );
        }
      }
    } catch (error) {
      summary.failed += 1;
      summary.outcomes.push({
        tokenId,
        status: "failed",
        reason: stringifyError(error),
      });
      console.error("[indexer] token processing failed", {
        tokenId,
        error: stringifyError(error),
      });
    }

    if (config.sleepMs > 0) {
      await sleep(config.sleepMs);
    }
  }

  if (!config.dryRun && pendingMetadataUpdates.length > 0) {
    await flushPendingMetadataUpdates(
      contract,
      pendingMetadataUpdates,
      config.confirmations,
      summary
    );
  }

  finalizeSummary(summary, started);
  console.log("[indexer] run finished", JSON.stringify(summary));
  return summary;
}

function loadConfig(env: Bindings, options: RunIndexerOptions): IndexerConfig {
  const enabled = parseBoolean(env.INDEXER_ENABLED, true);
  const dryRun = options.dryRun ?? parseBoolean(env.INDEXER_DRY_RUN, false);
  const workerBaseUrl = (env.INDEXER_WORKER_BASE_URL || env.WORKER_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const tzktBase = (env.INDEXER_TZKT_API || DEFAULT_GHOSTNET_TZKT_API)
    .trim()
    .replace(/\/+$/, "");
  const rpcUrl = (env.INDEXER_RPC_URL || DEFAULT_GHOSTNET_RPC_URL).trim();
  const contract = (
    env.INDEXER_GENERIC_WEB_CONTRACT || DEFAULT_GHOSTNET_GENERIC_WEB_CONTRACT
  ).trim();
  const privateKey = (env.INDEXER_PRIVATE_KEY || "").trim();

  const envLimit = parseBoundedInt(env.INDEXER_LIMIT, 10, 1, 200);
  const limit = parseBoundedInt(options.limit, envLimit, 1, 200);
  const sleepMs = parseBoundedInt(env.INDEXER_SLEEP_MS, 0, 0, 10_000);
  const operationBatchSize = parseBoundedInt(
    env.INDEXER_OPERATION_BATCH_SIZE,
    5,
    1,
    25
  );
  const attributeRetries = parseBoundedInt(
    env.INDEXER_ATTRIBUTE_RETRIES,
    4,
    0,
    15
  );
  const attributeRetryDelayMs = parseBoundedInt(
    env.INDEXER_ATTRIBUTE_RETRY_DELAY_MS,
    750,
    100,
    10_000
  );
  const confirmations = parseBoundedInt(env.INDEXER_CONFIRMATIONS, 1, 1, 5);

  return {
    enabled,
    dryRun,
    workerBaseUrl,
    tzktBase,
    rpcUrl,
    contract,
    privateKey,
    limit,
    sleepMs,
    operationBatchSize,
    attributeRetries,
    attributeRetryDelayMs,
    confirmations,
  };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseBoundedInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  return Math.max(min, Math.min(max, truncated));
}

function toNat(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const nat = Math.trunc(parsed);
  return Number.isSafeInteger(nat) ? nat : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function extractOptionBytes(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    return value.startsWith("0x") ? value.slice(2) : value;
  }
  if (typeof value === "object") {
    const asObj = value as Record<string, unknown>;
    const maybe = asObj.Some ?? asObj.some ?? asObj.bytes ?? asObj.value;
    if (typeof maybe === "string") {
      return maybe.startsWith("0x") ? maybe.slice(2) : maybe;
    }
  }
  return null;
}

function decodeHexToText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  const candidate = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/.test(candidate) || candidate.length % 2 !== 0) {
    return value;
  }

  try {
    const bytes = new Uint8Array(candidate.length / 2);
    for (let index = 0; index < candidate.length; index += 2) {
      bytes[index / 2] = parseInt(candidate.slice(index, index + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

async function fetchBigmapPointers(
  config: IndexerConfig
): Promise<BigmapPointers> {
  const bigmaps = await fetchJson<Array<{ path?: string; ptr?: number }>>(
    `${config.tzktBase}/v1/contracts/${config.contract}/bigmaps`
  );

  const pointerByPath = new Map<string, number>();
  for (const row of bigmaps) {
    if (typeof row.path === "string" && typeof row.ptr === "number") {
      pointerByPath.set(row.path, row.ptr);
    }
  }

  const tokenExtra = pointerByPath.get("token_extra");
  const tokenMetadata = pointerByPath.get("token_metadata");
  const generators = pointerByPath.get("generators");

  if (tokenExtra == null || tokenMetadata == null || generators == null) {
    throw new Error("Failed to resolve generic-web bigmap pointers from TzKT");
  }

  return { tokenExtra, tokenMetadata, generators };
}

async function fetchPendingQueue(
  config: IndexerConfig,
  tokenExtraPtr: number,
  tokenId?: number
): Promise<QueueRow[]> {
  if (typeof tokenId === "number" && Number.isFinite(tokenId) && tokenId >= 0) {
    const payload = await fetchBigmapKey(
      config,
      tokenExtraPtr,
      Math.trunc(tokenId)
    );
    if (!payload) return [];

    const value = asRecord(payload.value) as QueueRowValue;
    return [
      {
        key: tokenId,
        value,
      },
    ];
  }

  const filteredQuery = new URLSearchParams({
    active: "true",
    limit: String(config.limit),
    "value.offchain_metadata_updated": "false",
  });
  const filteredUrl = `${
    config.tzktBase
  }/v1/bigmaps/${tokenExtraPtr}/keys?${filteredQuery.toString()}`;

  try {
    const filteredRows = await fetchJson<QueueRow[]>(filteredUrl);
    if (Array.isArray(filteredRows)) {
      return filteredRows;
    }
  } catch (error) {
    console.warn("[indexer] filtered queue query failed, falling back", {
      tokenExtraPtr,
      error: stringifyError(error),
    });
    // fallback below
  }

  const fallbackQuery = new URLSearchParams({
    active: "true",
    limit: String(config.limit),
  });
  const fallbackUrl = `${
    config.tzktBase
  }/v1/bigmaps/${tokenExtraPtr}/keys?${fallbackQuery.toString()}`;
  const fallbackRows = await fetchJson<QueueRow[]>(fallbackUrl);
  if (!Array.isArray(fallbackRows)) return [];
  return fallbackRows.filter(
    (row) => !Boolean(asRecord(row.value).offchain_metadata_updated)
  );
}

async function fetchBigmapKey(
  config: IndexerConfig,
  pointer: number,
  key: number
): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${config.tzktBase}/v1/bigmaps/${pointer}/keys/${key}`
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`TzKT key lookup failed (${response.status}): ${body}`);
  }
  const payload = await response.json().catch(() => null);
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

async function triggerFeatureExtraction(
  config: IndexerConfig,
  tokenId: number,
  version: number
): Promise<void> {
  const url = new URL(
    `/generic-web/v1/thumbnail/${tokenId}`,
    config.workerBaseUrl
  );
  url.searchParams.set("n", GHOSTNET_NETWORK_CODE);
  url.searchParams.set("v", String(version));
  url.searchParams.set("sync_features", "1");

  const response = await fetch(url.toString(), {
    headers: { accept: "image/png" },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Thumbnail warmup failed (${response.status}): ${body}`);
  }

  // Drain the body so proxy/caching work completes before polling D1.
  await response.arrayBuffer().catch(() => undefined);
}

async function pollTokenAttributes(
  config: IndexerConfig,
  tokenService: TokenService,
  tokenId: number
): Promise<Array<{ name: string; value: string | number | boolean }>> {
  for (let attempt = 0; attempt <= config.attributeRetries; attempt += 1) {
    const token = await tokenService.getTokenWithAttributes(
      tokenId,
      GHOSTNET_NETWORK,
      "generic-web"
    );
    const attrs = (token?.attributes || []).map((entry) => ({
      name: entry.name,
      value: (() => {
        if (entry.type === "number") {
          if (
            entry.numericValue != null &&
            Number.isFinite(entry.numericValue)
          ) {
            return entry.numericValue;
          }
          const parsed = Number(entry.value);
          return Number.isFinite(parsed) ? parsed : entry.value;
        }
        if (entry.type === "boolean") {
          return entry.value.toLowerCase() === "true";
        }
        return entry.value ?? "";
      })(),
    }));

    if (attrs.length > 0 || attempt === config.attributeRetries) {
      console.log(
        "[indexer] poll attributes attempt",
        JSON.stringify({ tokenId, attempt, count: attrs.length })
      );
      return attrs;
    }

    console.log(
      "[indexer] poll attributes retrying",
      JSON.stringify({
        tokenId,
        attempt,
        delayMs: config.attributeRetryDelayMs,
      })
    );
    await sleep(config.attributeRetryDelayMs);
  }

  return [];
}

function buildMetadataPayload({
  generatorValue,
  generatorMeta,
  attributes,
}: {
  generatorValue: Record<string, unknown>;
  generatorMeta: Awaited<ReturnType<GeneratorService["getGenerator"]>>;
  attributes: Array<{ name: string; value: string | number | boolean }>;
}): Record<string, unknown> {
  const generatorName = decodeHexToText(generatorValue.name);

  const description =
    generatorMeta?.tokenDescription?.trim() ||
    generatorMeta?.generatorDescription?.trim() ||
    (generatorName ? `Token from ${generatorName}` : "Bootloader token");

  const dedupedAttributes = new Map<string, string | number | boolean>();
  for (const attribute of attributes) {
    const name = attribute.name?.trim();
    if (!name) continue;
    dedupedAttributes.set(name, attribute.value);
  }

  return {
    description,
    symbol: "BTLDR",
    decimals: 0,
    attributes: Array.from(dedupedAttributes.entries()).map(
      ([name, value]) => ({ name, value })
    ),
  };
}

async function loadContractIfNeeded(
  config: IndexerConfig
): Promise<any | null> {
  if (config.dryRun) return null;

  // Some transitive signer deps expect Node's `global` symbol.
  if (!(globalThis as any).global) {
    (globalThis as any).global = globalThis;
  }

  // Some transitive deps reference `process` directly.
  if (!(globalThis as any).process) {
    (globalThis as any).process = {
      env: {},
      argv: [],
      version: "",
      versions: {},
      platform: "worker",
      release: { name: "node" },
      cwd: () => "/",
      nextTick: (cb: (...args: any[]) => void, ...args: any[]) => {
        queueMicrotask(() => cb(...args));
      },
    };
  }

  const [taquitoModule, signerModule] = await Promise.all([
    import("@taquito/taquito"),
    import("@taquito/signer"),
  ]);

  const TezosToolkit =
    (taquitoModule as any).TezosToolkit ??
    (taquitoModule as any).default?.TezosToolkit ??
    (taquitoModule as any).default?.default?.TezosToolkit;
  const InMemorySigner =
    (signerModule as any).InMemorySigner ??
    (signerModule as any).default?.InMemorySigner ??
    (signerModule as any).default?.default?.InMemorySigner;

  if (!TezosToolkit || !InMemorySigner?.fromSecretKey) {
    const signerKeys = Object.keys((signerModule as any) || {});
    const signerDefaultKeys = Object.keys((signerModule as any)?.default || {});
    throw new Error(
      `Taquito signer exports not available in runtime (signer keys: ${signerKeys.join(
        ","
      )}; signer.default keys: ${signerDefaultKeys.join(",")})`
    );
  }

  const signer = await InMemorySigner.fromSecretKey(config.privateKey);
  const tezos = new TezosToolkit(config.rpcUrl);
  tezos.setProvider({ signer });
  return tezos.contract.at(config.contract);
}

async function setOffchainMetadata(
  contractPromise: Promise<any> | any,
  tokenId: number,
  metadataCid: string,
  confirmations: number
): Promise<string> {
  const contract = await contractPromise;
  const metadataBytes = utf8ToBytesHex(metadataCid);
  const method = contract.methodsObject?.set_offchain_metadata
    ? contract.methodsObject.set_offchain_metadata({
        token_id: tokenId,
        metadata_cid: metadataBytes,
      })
    : contract.methods.set_offchain_metadata(tokenId, metadataBytes);

  const operation = await method.send();
  if (typeof operation.confirmation === "function") {
    await operation.confirmation(confirmations);
  }

  const hash = operation.hash || operation.opHash || "";
  return typeof hash === "string" ? hash : "";
}

async function setOffchainMetadataBatch(
  contractPromise: Promise<any> | any,
  updates: PendingMetadataUpdate[],
  confirmations: number
): Promise<string> {
  const contract = await contractPromise;
  if (
    !contract?.contractProvider?.batch ||
    !contract?.methodsObject?.set_offchain_metadata
  ) {
    throw new Error(
      "Contract batch API is unavailable for set_offchain_metadata"
    );
  }

  const batch = contract.contractProvider.batch();
  for (const update of updates) {
    const metadataBytes = utf8ToBytesHex(update.metadataCid);
    batch.withContractCall(
      contract.methodsObject.set_offchain_metadata({
        token_id: update.tokenId,
        metadata_cid: metadataBytes,
      })
    );
  }

  const operation = await batch.send();
  if (typeof operation.confirmation === "function") {
    await operation.confirmation(confirmations);
  }

  const hash = operation.hash || operation.opHash || "";
  return typeof hash === "string" ? hash : "";
}

async function flushPendingMetadataUpdates(
  contractPromise: Promise<any> | any,
  updates: PendingMetadataUpdate[],
  confirmations: number,
  summary: IndexerRunSummary
): Promise<void> {
  if (updates.length === 0) return;

  if (updates.length > 1) {
    try {
      const operationHash = await setOffchainMetadataBatch(
        contractPromise,
        updates,
        confirmations
      );
      for (const update of updates) {
        summary.processed += 1;
        summary.outcomes.push({
          tokenId: update.tokenId,
          status: "processed",
          metadataCid: update.metadataCid,
          operationHash,
        });
      }

      console.log(
        "[indexer] on-chain metadata batch sent",
        JSON.stringify({
          operationHash,
          count: updates.length,
          tokenIds: updates.map((update) => update.tokenId),
        })
      );
      return;
    } catch (error) {
      console.error(
        "[indexer] metadata batch failed, falling back to single sends",
        {
          count: updates.length,
          tokenIds: updates.map((update) => update.tokenId),
          error: stringifyError(error),
        }
      );
    }
  }

  for (const update of updates) {
    try {
      const operationHash = await setOffchainMetadata(
        contractPromise,
        update.tokenId,
        update.metadataCid,
        confirmations
      );
      summary.processed += 1;
      summary.outcomes.push({
        tokenId: update.tokenId,
        status: "processed",
        metadataCid: update.metadataCid,
        operationHash,
      });
      console.log(
        "[indexer] on-chain metadata update sent",
        JSON.stringify({ tokenId: update.tokenId, operationHash })
      );
    } catch (error) {
      summary.failed += 1;
      summary.outcomes.push({
        tokenId: update.tokenId,
        status: "failed",
        reason: stringifyError(error),
      });
      console.error("[indexer] token metadata update failed", {
        tokenId: update.tokenId,
        error: stringifyError(error),
      });
    }
  }
}

function utf8ToBytesHex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `0x${hex}`;
}

function markSkipped(
  summary: IndexerRunSummary,
  tokenId: number,
  reason: string
): void {
  summary.skipped += 1;
  summary.skippedByReason[reason] = (summary.skippedByReason[reason] || 0) + 1;
  summary.outcomes.push({
    tokenId,
    status: "skipped",
    reason,
  });
  console.log("[indexer] skipped token", JSON.stringify({ tokenId, reason }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GET ${url} failed (${response.status}): ${body}`);
  }
  return (await response.json()) as T;
}

function finalizeSummary(
  summary: IndexerRunSummary,
  startedAtMs: number
): void {
  const finishedMs = Date.now();
  summary.finishedAt = new Date(finishedMs).toISOString();
  summary.durationMs = finishedMs - startedAtMs;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
