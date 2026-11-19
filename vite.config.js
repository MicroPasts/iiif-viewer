import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'docs') {
    return {
      base: './',
      plugins: [tailwindcss()],
      build: {
        outDir: 'docs',
        emptyOutDir: true,
      },
    };
  }

  return {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/images': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/finds': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      copyPublicDir: false,
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'IIIFViewer',
        fileName: 'iiif-viewer',
      },
      cssCodeSplit: false,
    },
  };
});