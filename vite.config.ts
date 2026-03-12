import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: '/frame_viz',
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
});
