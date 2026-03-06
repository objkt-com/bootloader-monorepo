import type { BootloaderId } from "@/types/bootloader";
import type { SharedBootloaderId } from "../../../../shared/bootloaders/catalog";
import {
  getSharedBootloaderArtifactContract,
  getSharedBootloaderRngContract,
  SHARED_BOOTLOADER_CONTRACTS,
} from "../../../../shared/bootloaders/contracts";

export const NETWORKS = {
  mainnet: {
    name: "Mainnet",
    rpcUrl: "https://rpc.objkt.com",
    tzktApi: "https://api.tzkt.io",
    objktApi: "https://data.objkt.com/v3/graphql",
  },
  shadownet: {
    name: "Shadownet",
    rpcUrl: "https://rpc.shadownet.teztnets.com",
    tzktApi: "https://api.shadownet.tzkt.io",
    objktApi: "https://data.shadownet.objkt.com/v3/graphql",
  },
} as const;

export const CONFIG = {
  // Network configuration - use environment variable or default to shadownet
  network: (import.meta.env.VITE_NETWORK || "shadownet") as
    | "mainnet"
    | "shadownet",

  bootloaderContracts: SHARED_BOOTLOADER_CONTRACTS,

  // App branding
  branding: {
    projectName: "bootloader:",
    tagline: "Pick a bootloader. Boot an artwork. Mint it as a token.",
  },

  // Default preview seed for consistent generator previews
  defaultPreviewSeed: "888888",

  // Sandbox worker URL (for generic-web bootloader)
  // In development, use empty string to use relative URLs (going through Vite proxy)
  // In production, set VITE_SANDBOX_WORKER_URL to the actual worker URL
  sandboxWorkerUrl: import.meta.env.VITE_SANDBOX_WORKER_URL || "",

  // Media CDN for thumbnails
  // In development, use empty string to use relative URLs (going through Vite proxy)
  // In production, this resolves to the worker URL or media.bootloader.art
  mediaCdnUrl: import.meta.env.VITE_MEDIA_CDN_URL || "",

  // Flag reasons mapping
  flagReasons: {
    1: "Copyright violation",
  } as Record<number, string>,

  // Platform fee taken on primary mint sales (percentage)
  primarySaleFeePercent: {
    "generic-web": 15,
    "svg-js": 20,
  } as Record<BootloaderId, number>,
};

export function getNetworkConfig() {
  const network = NETWORKS[CONFIG.network];
  const contractAddress = getSharedBootloaderArtifactContract("svg-js", CONFIG.network);
  const objktUrl =
    CONFIG.network === "mainnet"
      ? "https://objkt.com"
      : "https://shadownet.objkt.com";

  return {
    ...network,
    contractAddress,
    objktUrl,
  };
}

/**
 * Get TzKT explorer base URL (non-API host), e.g.
 * - https://api.tzkt.io -> https://tzkt.io
 * - https://api.shadownet.tzkt.io -> https://shadownet.tzkt.io
 */
export function getTzktExplorerBaseUrl(): string {
  const { tzktApi } = getNetworkConfig();
  const url = new URL(tzktApi);
  if (url.hostname === "api.tzkt.io") {
    url.hostname = "tzkt.io";
  } else if (url.hostname.startsWith("api.")) {
    url.hostname = url.hostname.slice(4);
  }
  return `${url.protocol}//${url.hostname}`;
}

export function getContractAddress() {
  return getSharedBootloaderArtifactContract("svg-js", CONFIG.network);
}

export function getGenericWebContractAddress() {
  return getSharedBootloaderArtifactContract("generic-web", CONFIG.network);
}

export function getRngContractAddress() {
  return getSharedBootloaderRngContract("generic-web", CONFIG.network);
}

/**
 * Get the contract address for a specific bootloader type
 */
export function getContractAddressForBootloader(
  bootloaderId: SharedBootloaderId | string
): string {
  if (bootloaderId === "generic-web" || bootloaderId === "svg-js") {
    return getSharedBootloaderArtifactContract(bootloaderId, CONFIG.network);
  }
  return getSharedBootloaderArtifactContract("svg-js", CONFIG.network);
}

/**
 * Get the network code for thumbnail URLs
 * m = mainnet, s = shadownet
 */
export function getNetworkCode(): "m" | "s" {
  return CONFIG.network === "mainnet" ? "m" : "s";
}

/**
 * Get thumbnail URL for a generator
 * Format: /{bootloader}/v1/generator-thumbnail/{generatorId}?v={version}&n={network}
 */
export function getGeneratorThumbnailUrl(
  generatorId: string | number,
  version?: number,
  bootloaderId: SharedBootloaderId | string = "svg-js"
): string {
  const base = CONFIG.mediaCdnUrl;
  const params = new URLSearchParams();
  if (version !== undefined) {
    params.set("v", String(version));
  }
  params.set("n", getNetworkCode());
  return `${base}/${bootloaderId}/v1/generator-thumbnail/${generatorId}?${params.toString()}`;
}

/**
 * Get thumbnail URL for a token
 * Format: /{bootloader}/v1/thumbnail/{tokenId}?n={network}[&v={generatorVersion}]
 */
export function getTokenThumbnailUrl(
  tokenId: string | number,
  generatorVersion?: number,
  bootloaderId: SharedBootloaderId | string = "svg-js"
): string {
  const base = CONFIG.mediaCdnUrl;
  const params = new URLSearchParams();
  if (
    generatorVersion !== undefined &&
    Number.isFinite(generatorVersion) &&
    generatorVersion > 0
  ) {
    params.set("v", String(Math.trunc(generatorVersion)));
  }
  params.set("n", getNetworkCode());
  return `${base}/${bootloaderId}/v1/thumbnail/${tokenId}?${params.toString()}`;
}

export function getPrimarySaleFeePercent(bootloaderId: BootloaderId): number {
  return CONFIG.primarySaleFeePercent[bootloaderId];
}

/**
 * @deprecated Use getGeneratorThumbnailUrl or getTokenThumbnailUrl instead
 */
export function getThumbnailUrl(
  generatorId: string | number,
  tokenId?: string | number,
  version?: number
): string {
  // For backwards compatibility - if tokenId is provided, treat first arg as generatorId
  // and return a token thumbnail URL
  if (tokenId !== undefined) {
    return getTokenThumbnailUrl(tokenId, version);
  }
  // Otherwise return generator thumbnail
  return getGeneratorThumbnailUrl(generatorId, version);
}
