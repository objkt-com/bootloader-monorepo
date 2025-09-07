export const NETWORKS = {
  mainnet: {
    name: "Mainnet",
    rpcUrl: "https://tcinfra.net/rpc/tezos/mainnet",
    tzktApi: "https://api.tzkt.io",
  },
  ghostnet: {
    name: "Ghostnet",
    rpcUrl: "https://tcinfra.net/rpc/tezos/ghostnet",
    tzktApi: "https://api.ghostnet.tzkt.io",
  },
};

export const CONFIG = {
  // Network configuration - use environment variable or default to ghostnet
  network: import.meta.env.VITE_NETWORK || "ghostnet",

  // Contract addresses (generator contract is also the FA2 contract)
  contracts: {
    ghostnet: "KT1Qv9p4Vpu4CE8imbPSTcHsuCCLYCTNPzD7",
    mainnet: null, // To be deployed
  },

  // App branding
  branding: {
    projectName: "bootloader",
    tagline: "open experimental on-chain long-form generative art",
  },
};

export const getNetworkConfig = () => {
  return NETWORKS[CONFIG.network];
};

export const getContractAddress = () => {
  return CONFIG.contracts[CONFIG.network];
};
