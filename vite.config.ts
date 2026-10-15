import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const apiPort = process.env.API_PORT ?? '8787';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': `http://localhost:${apiPort}` } },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('three-globe') || id.includes('react-globe.gl') || id.includes('kapsule') || id.includes('three-conic') || id.includes('three-geojson') || id.includes('earcut') || id.includes('d3-')) return 'globe';
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('leaflet')) return 'leaflet';
        },
      },
    },
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'server/**/*.test.ts'] },
});
