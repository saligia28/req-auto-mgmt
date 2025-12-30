import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const monacoEditorPlugin = require('vite-plugin-monaco-editor').default;

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService'],
      customWorkers: [],
    }),
  ],
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer/src'),
    },
  },
  server: {
    port: 3499,
    strictPort: true,
  },
});
