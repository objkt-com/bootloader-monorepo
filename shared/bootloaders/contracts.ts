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
      shadownet: "KT1XivGXG8XawFFwWMEjbuuEN9Yx2TtiBCY8",
      mainnet: "",
    },
    rngContract: {
      shadownet: "KT1B5hbpdGcspvLKANU4ABU3LakMtwNBEuuR",
      mainnet: "",
    },
  },
  "p5-js": {
    artifactContract: {
      shadownet: "KT1XivGXG8XawFFwWMEjbuuEN9Yx2TtiBCY8",
      mainnet: "",
    },
    rngContract: {
      shadownet: "KT1B5hbpdGcspvLKANU4ABU3LakMtwNBEuuR",
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
