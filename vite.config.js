import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    // Windows-mounted WSL folders can miss native file change notifications.
    watch: { usePolling: process.cwd().startsWith('/mnt/'), interval: 300 },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
