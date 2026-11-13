import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'playground',
  base: '/eddy-editor/',
  resolve: {
    alias: {
      'eddy-editor/vue': resolve(__dirname, 'src/vue.ts'),
      'eddy-editor/react': resolve(__dirname, 'src/react.tsx'),
      'eddy-editor': resolve(__dirname, 'src/index.ts'),
    },
  },
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'playground/index.html'),
        'custom-toolbar': resolve(__dirname, 'playground/custom-toolbar.html'),
      },
    },
  },
})
