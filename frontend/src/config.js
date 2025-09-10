export const NETWORKS = {
  mainnet: {
    name: "Mainnet",
    rpcUrl: "https://rpc.objkt.com",
    tzktApi: "https://api.tzkt.io",
    objktApi: "https://data.objkt.com/v3/graphql",
  },
  ghostnet: {
    name: "Ghostnet",
    rpcUrl: "https://rpc.ghostnet.teztnets.com",
    tzktApi: "https://api.ghostnet.tzkt.io",
    objktApi: "https://data.ghostnet.objkt.com/v3/graphql",
  },
};

export const CONFIG = {
  // Network configuration - use environment variable or default to ghostnet
  network: import.meta.env.VITE_NETWORK || "ghostnet",

  // Contract addresses (generator contract is also the FA2 contract)
  contracts: {
    ghostnet: "KT1BppPWBUnRLHLGBkmj8VySVdU2YBwLTqRM",
    mainnet: null, // To be deployed
  },

  // App branding
  branding: {
    projectName: "bootloader:",
    tagline: "open experimental on-chain long-form generative art",
  },

  // Default preview seed for consistent generator previews
  defaultPreviewSeed: 888888,
};

export const getNetworkConfig = () => {
  return NETWORKS[CONFIG.network];
};

export const getContractAddress = () => {
  return CONFIG.contracts[CONFIG.network];
};
