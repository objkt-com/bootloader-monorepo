import { BOOT_WEB_SPEC } from "./boot-web";

export const BOOTLOADER_IDS = ["svg-js", "generic-web"] as const;
export type SharedBootloaderId = (typeof BOOTLOADER_IDS)[number];

export interface SharedBootloaderCatalogEntry {
  id: SharedBootloaderId;
  currentVersion: string;
  spec: string;
  storageType: "onchain" | "ipfs" | "hybrid";
  supportsIndexedFeatures: boolean;
  supportsDedicatedEditRoute: boolean;
  supportsGeneratorMetadata: boolean;
}

export const SHARED_BOOTLOADER_CATALOG: Record<
  SharedBootloaderId,
  SharedBootloaderCatalogEntry
> = {
  "svg-js": {
    id: "svg-js",
    currentVersion: "0.0.1",
    spec: "svg-js:0.0.1",
    storageType: "onchain",
    supportsIndexedFeatures: false,
    supportsDedicatedEditRoute: false,
    supportsGeneratorMetadata: false,
  },
  "generic-web": {
    id: "generic-web",
    currentVersion: "1.0.0",
    spec: BOOT_WEB_SPEC,
    storageType: "ipfs",
    supportsIndexedFeatures: true,
    supportsDedicatedEditRoute: true,
    supportsGeneratorMetadata: true,
  },
};

export function isSharedBootloaderId(value: string): value is SharedBootloaderId {
  return (BOOTLOADER_IDS as readonly string[]).includes(value);
}

export function getSharedBootloaderCatalogEntry(
  id: SharedBootloaderId
): SharedBootloaderCatalogEntry {
  return SHARED_BOOTLOADER_CATALOG[id];
}
