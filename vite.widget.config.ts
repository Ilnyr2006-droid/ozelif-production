import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-tilda-widget',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/tilda-widget.tsx',
      name: 'OzelifTildaWidget',
      formats: ['iife'],
      fileName: () => 'ozelif-ai-widget.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: assetInfo =>
          assetInfo.name?.endsWith('.css')
            ? 'ozelif-ai-widget.css'
            : 'assets/[name][extname]',
      },
    },
  },
})
