import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('lowlight')) {
            return 'syntax-highlight';
          }

          if (
            id.includes('@tiptap') ||
            id.includes('prosemirror') ||
            id.includes('yjs') ||
            id.includes('y-websocket') ||
            id.includes('y-indexeddb')
          ) {
            return 'editor-runtime';
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'test-results/**'],
  },
});
