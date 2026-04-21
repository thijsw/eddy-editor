import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        vue: 'src/vue/index.ts',
        react: 'src/react/index.ts',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['vue', 'react', 'react-dom', 'react/jsx-runtime', '@lucide/vue', 'lucide-react'],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})
