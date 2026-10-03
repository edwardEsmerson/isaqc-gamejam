import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '0.0.0.0' },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
