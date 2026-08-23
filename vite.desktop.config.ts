import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: resolve(repoRoot, 'apps/desktop'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(repoRoot, 'dist-desktop'),
    emptyOutDir: true,
  },
})
