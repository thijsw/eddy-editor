import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        vue: 'src/vue.ts',
        react: 'src/react.tsx',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['vue', 'react', 'react/jsx-runtime'],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})
