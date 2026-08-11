import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const reasoningUtilityModules = [
  path.resolve(__dirname, 'features/reasoning/services/agentInspection.ts'),
  path.resolve(__dirname, 'features/reasoning/services/codeHighlight.ts'),
  path.resolve(__dirname, 'features/reasoning/services/voiceTranscript.ts'),
];

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    chunkSizeWarningLimit: 350,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'reasoning-utils': reasoningUtilityModules,
        },
      },
    },
  },
});
