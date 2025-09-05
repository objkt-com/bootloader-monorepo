export const NETWORKS = {
  mainnet: {
    name: 'Mainnet',
    rpcUrl: 'https://mainnet.api.tez.ie',
    tzktApi: 'https://api.tzkt.io',
  },
  ghostnet: {
    name: 'Ghostnet',
    rpcUrl: 'https://ghostnet.tezos.ecadinfra.com',
    tzktApi: 'https://api.ghostnet.tzkt.io',
  }
};

export const CONFIG = {
  // Network configuration
  network: 'ghostnet',
  
  // Contract addresses (generator contract is also the FA2 contract)
  contracts: {
    ghostnet: 'KT1AqyXgCqAeibWeGZkYnLPuABRfm9HB7zje',
    mainnet: null // To be deployed
  },
  
  // App branding
  branding: {
    projectName: 'SVJKT',
    tagline: 'On-chain SVG Generator Platform'
  },
  
  // Polling intervals (in milliseconds)
  polling: {
    contractStorage: 30000, // 30 seconds
    transactionStatus: 2000, // 2 seconds
  }
};

export const getNetworkConfig = () => {
  return NETWORKS[CONFIG.network];
};

export const getContractAddress = () => {
  return CONFIG.contracts[CONFIG.network];
};
