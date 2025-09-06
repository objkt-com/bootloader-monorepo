import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    // Custom plugin to copy 404.html to dist root
    {
      name: 'copy-404',
      writeBundle() {
        copyFileSync(
          resolve(__dirname, 'public/404.html'),
          resolve(__dirname, 'dist/404.html')
        )
      }
    }
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
