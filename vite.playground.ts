import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'playground',
  resolve: {
    alias: {
      'eddy-editor': resolve(__dirname, 'src/index.ts'),
    },
  },
  plugins: [vue()],
})
