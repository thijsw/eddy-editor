import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'playground-react',
  resolve: {
    alias: {
      'eddy-editor/vue': resolve(__dirname, 'src/vue.ts'),
      'eddy-editor/react': resolve(__dirname, 'src/react.tsx'),
      'eddy-editor': resolve(__dirname, 'src/index.ts'),
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'playground-react/index.html'),
      },
    },
  },
})
