/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK: 'mainnet' | 'ghostnet'
  readonly VITE_SANDBOX_WORKER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
