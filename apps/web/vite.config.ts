import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'stream', 'util', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_NETWORK': JSON.stringify(mode === 'mainnet' ? 'mainnet' : 'shadownet'),
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/sessions': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/ipfs': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Token and generator API routes
      '/tokens': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generators': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Thumbnail routes - namespaced
      '/svg-js/v1/thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/svg-js/v1/generator-thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/svg-js/v1/tokens': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/svg-js/v1/generators': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generic-web/v1/thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generic-web/v1/generator-thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generic-web/v1/tokens': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generic-web/v1/generators': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generic-web/v1/indexer': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Legacy thumbnail routes
      '/thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/generator-thumbnail': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      // Viewer route for Screenshot One
      '/viewer': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}))
