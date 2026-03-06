import JSZip from "jszip";
import type { TezosToolkit } from "@taquito/taquito";
import { CONFIG } from "@/config";
import {
  detectArchiveRootPrefix,
  normalizeArchivePath,
  parseBootWebManifest,
  stripArchivePrefix,
} from "../../../../../shared/bootloaders/boot-web";

const MB = 1024 * 1024;

export const GENERIC_WEB_MAX_ARCHIVE_SIZE_BYTES = 50 * MB;
export const GENERIC_WEB_MAX_FILES_PER_ARCHIVE = 2000;
export const GENERIC_WEB_MAX_TOTAL_UNCOMPRESSED_BYTES = 80 * MB;
export const GENERIC_WEB_MAX_RENDER_BATCH = 5;
export const GENERIC_WEB_MAX_RENDER_PER_MINUTE = 10;

export interface GenericWebRenderJobResult {
  fullResKey: string;
  thumbnailKey: string;
  mime: string;
  fullResolution?: { x: number; y: number };
  thumbnailResolution?: { x: number; y: number };
  features?: Record<string, unknown> | null;
  params?: Record<string, unknown> | null;
}

export interface GenericWebRenderJob {
  jobId: string;
  state: "pending" | "processing" | "complete" | "error";
  requestedAt?: number;
  completedAt?: number;
  error?: string;
  seed?: string;
  params?: Record<string, unknown> | null;
  result?: GenericWebRenderJobResult;
}

export interface GenericWebSessionData {
  sessionId: string;
  cid: string;
  defaultEntry: string;
  fileCount: number;
}

export interface GenericWebMetadataRecordInput {
  generatorId: string;
  name: string;
  artifactCid: string;
  metadataCid?: string;
  generatorDescription?: string;
  tokenDescription?: string;
  thumbnailSeed?: string;
  authToken: string;
  tezos: TezosToolkit;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function generateGenericWebSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateGenericWebArchive(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Please upload a .zip archive");
  }

  if (file.size > GENERIC_WEB_MAX_ARCHIVE_SIZE_BYTES) {
    throw new Error(
      `Archive is too large (${formatMegabytes(
        file.size
      )}). Max ${formatMegabytes(GENERIC_WEB_MAX_ARCHIVE_SIZE_BYTES)} per upload.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const entries = Object.entries(zip.files).filter(
    ([path, entry]) => !entry.dir && !path.startsWith("__MACOSX/")
  );

  if (entries.length === 0) {
    throw new Error("Archive contains no files");
  }

  if (entries.length > GENERIC_WEB_MAX_FILES_PER_ARCHIVE) {
    throw new Error(
      `Archive has too many files (${entries.length}). Max ${GENERIC_WEB_MAX_FILES_PER_ARCHIVE} files per upload.`
    );
  }

  const normalizedEntries: Array<{
    path: string;
    entry: JSZip.JSZipObject;
  }> = [];
  for (const [rawPath, entry] of entries) {
    const normalizedPath = normalizeArchivePath(rawPath.replace(/\\/g, "/"));
    if (!normalizedPath) continue;
    normalizedEntries.push({ path: normalizedPath, entry });
  }

  if (normalizedEntries.length === 0) {
    throw new Error("Archive contains no valid files");
  }

  const rootPrefix = detectArchiveRootPrefix(
    normalizedEntries.map((entry) => entry.path)
  );
  const projectEntries = normalizedEntries.map((entry) => ({
    path: stripArchivePrefix(entry.path, rootPrefix),
    entry: entry.entry,
  }));

  if (!projectEntries.some((entry) => entry.path === "index.html")) {
    throw new Error("Archive must include index.html at the project root");
  }

  const manifestEntry = projectEntries.find(
    (entry) => entry.path === "manifest.json"
  );
  if (manifestEntry) {
    parseBootWebManifest(await manifestEntry.entry.async("text"));
  }

  let totalUncompressedBytes = 0;
  for (const { entry } of normalizedEntries) {
    const content = await entry.async("uint8array");
    totalUncompressedBytes += content.length;
    if (totalUncompressedBytes > GENERIC_WEB_MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Archive expands to ${formatMegabytes(
          totalUncompressedBytes
        )}. Max ${formatMegabytes(
          GENERIC_WEB_MAX_TOTAL_UNCOMPRESSED_BYTES
        )} uncompressed content per upload.`
      );
    }
  }
}

async function parseSessionResponse(response: Response): Promise<GenericWebSessionData> {
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as GenericWebSessionData;
  return data;
}

export async function createGenericWebSession(
  file: File,
  authToken: string
): Promise<GenericWebSessionData> {
  await validateGenericWebArchive(file);

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${CONFIG.sandboxWorkerUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  return parseSessionResponse(response);
}

export async function createGenericWebSessionFromCid(
  cid: string,
  authToken: string
): Promise<GenericWebSessionData> {
  const response = await fetch(`${CONFIG.sandboxWorkerUrl}/sessions/from-cid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ cid }),
  });

  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: "Failed to initialize session" }));
    throw new Error(
      (data as { error?: string }).error || "Failed to initialize session"
    );
  }

  return parseSessionResponse(response);
}

export async function uploadGenericWebMetadataJson(
  authToken: string,
  metadata: {
    generator_description?: string;
    token_description?: string;
    thumbnail_seed?: string;
  }
): Promise<string> {
  if (Object.keys(metadata).length === 0) {
    return "";
  }

  const response = await fetch(`${CONFIG.sandboxWorkerUrl}/ipfs/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload metadata: ${errorText}`);
  }

  const data = (await response.json()) as { cid: string };
  return data.cid;
}

export async function storeGenericWebMetadataRecord({
  generatorId,
  name,
  artifactCid,
  metadataCid,
  generatorDescription,
  tokenDescription,
  thumbnailSeed,
  authToken,
  tezos,
}: GenericWebMetadataRecordInput): Promise<void> {
  const creatorAddress = await tezos.wallet.pkh();
  await fetch(
    `${CONFIG.sandboxWorkerUrl}/generic-web/v1/generators/${generatorId}/metadata?network=${CONFIG.network}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name,
        artifactCid: artifactCid.startsWith("ipfs://")
          ? artifactCid
          : `ipfs://${artifactCid}`,
        metadataCid: metadataCid || undefined,
        generatorDescription: generatorDescription || undefined,
        tokenDescription: tokenDescription || undefined,
        thumbnailSeed: thumbnailSeed || undefined,
        creatorAddress,
      }),
    }
  );
}

export async function triggerGenericWebTokenIndexer(
  tokenId: string,
  authToken: string,
  options?: { waitForCompletion?: boolean }
): Promise<void> {
  if (CONFIG.network !== "shadownet") {
    return;
  }

  const query = new URLSearchParams({
    network: "shadownet",
  });
  if (options?.waitForCompletion) {
    query.set("wait", "1");
  }

  const response = await fetch(
    `${CONFIG.sandboxWorkerUrl}/generic-web/v1/indexer/tokens/${encodeURIComponent(
      tokenId
    )}/trigger?${query.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Indexer trigger failed with status ${response.status}`);
  }
}
