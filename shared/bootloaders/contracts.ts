import type { SharedBootloaderId } from "./catalog";

export type SharedBootloaderNetwork = "mainnet" | "shadownet";

export interface SharedBootloaderContracts {
  artifactContract: Record<SharedBootloaderNetwork, string>;
  rngContract?: Record<SharedBootloaderNetwork, string>;
}

export const SHARED_BOOTLOADER_CONTRACTS: Record<
  SharedBootloaderId,
  SharedBootloaderContracts
> = {
  "svg-js": {
    artifactContract: {
      shadownet: "KT1M34LsFSPvBqCpE8DH3TVvf2PDqMbGhCfu",
      mainnet: "KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt",
    },
  },
  "generic-web": {
    artifactContract: {
      shadownet: "KT1MkVTbYNJ6hkJKWSukLBgPaXtkHFKugK6v",
      mainnet: "",
    },
    rngContract: {
      shadownet: "KT1Mub11JnyhBA8huycUekE26DFB5VW4SDqh",
      mainnet: "",
    },
  },
};

export function getSharedBootloaderArtifactContract(
  bootloaderId: SharedBootloaderId,
  network: SharedBootloaderNetwork
): string {
  return SHARED_BOOTLOADER_CONTRACTS[bootloaderId].artifactContract[network];
}

export function getSharedBootloaderRngContract(
  bootloaderId: SharedBootloaderId,
  network: SharedBootloaderNetwork
): string {
  return SHARED_BOOTLOADER_CONTRACTS[bootloaderId].rngContract?.[network] || "";
}
