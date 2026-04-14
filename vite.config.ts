import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'EddyEditor',
      formats: ['es'],
      fileName: () => 'eddy-editor.js',
    },
    rolldownOptions: {
      external: ['vue', '@lucide/vue'],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})
