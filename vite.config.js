import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (mode === 'docs') {
    return {
      base: './',
      plugins: [tailwindcss()],
      resolve: {
        alias: { '#map-worker-url': resolve(__dirname, 'src/map-worker-url-docs.js') },
      },
      build: {
        outDir: 'docs',
        emptyOutDir: true,
        chunkSizeWarningLimit: 800,
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'index.html'),
            'shadow-demo': resolve(__dirname, 'shadow-demo.html'),
          },
          output: {
            manualChunks: {
              three: ['three'],
              openseadragon: ['openseadragon'],
            },
          },
        },
      },
    };
  }

  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: { '#map-worker-url': resolve(__dirname, 'src/map-worker-url.js') },
    },
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
      chunkSizeWarningLimit: 1000,
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'IIIFViewer',
        fileName: 'iiif-viewer',
      },
      cssCodeSplit: false,
    },
  };
});