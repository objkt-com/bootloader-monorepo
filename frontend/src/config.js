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
    ghostnet: "KT1Cn7CvFueX5ozjUx14BZeN6RxGzED2uR2x",
    mainnet: "KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt",
  },

  // App branding
  branding: {
    projectName: "bootloader:",
    tagline: "open experimental on-chain long-form generative art",
  },

  // Default preview seed for consistent generator previews
  defaultPreviewSeed: 888888,

  // Flagging reasons mapping
  flagReasons: {
    1: "Copyright violation",
  },
};

export const getNetworkConfig = () => {
  return NETWORKS[CONFIG.network];
};

export const getContractAddress = () => {
  return CONFIG.contracts[CONFIG.network];
};
