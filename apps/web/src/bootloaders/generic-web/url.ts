import { CONFIG } from "@/config";
import type { BootloaderManifest } from "@/types/bootloader";
import { getBootWebEntry } from "../../../../../shared/bootloaders/boot-web";
import { encodeParamsForQuery } from "./param-encoder";

interface BuildGenericWebProjectUrlOptions {
  cid: string;
  manifest?: BootloaderManifest | null;
  entry?: string | null;
  seed: string;
  iteration?: number;
  params?: Record<string, unknown>;
  isCapture?: boolean;
  cacheBust?: string | number;
  baseUrl?: string;
}

export function buildGenericWebProjectUrl({
  cid,
  manifest,
  entry,
  seed,
  iteration = 0,
  params,
  isCapture = false,
  cacheBust,
  baseUrl = CONFIG.sandboxWorkerUrl,
}: BuildGenericWebProjectUrlOptions): string {
  const resolvedEntry = (entry || getBootWebEntry(manifest)).replace(/^\/+/, "");
  const query = new URLSearchParams();
  query.set("s", seed);

  if (Number.isFinite(iteration)) {
    query.set("i", String(Math.trunc(iteration)));
  }

  const encodedParams = params ? encodeParamsForQuery(params) : null;
  if (encodedParams) {
    query.set("p", encodedParams);
  }

  if (isCapture) {
    query.set("c", "true");
  }

  if (cacheBust !== undefined) {
    query.set("_", String(cacheBust));
  }

  return `${baseUrl}/ipfs/${cid}/${resolvedEntry}?${query.toString()}`;
}
