/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/frame_viz/' : '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          monaco: ['@monaco-editor/react'],
        },
      },
    },
  },
  server: {
    allowedHosts: ['a2824'],
    watch: {
      ignored: ['**/docs/**', '**/.superpowers/**'],
    },
  },
}));
