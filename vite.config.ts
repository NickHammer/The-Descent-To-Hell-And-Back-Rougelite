import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs so the same build works on Render (served at root)
  // and inside Electron (loaded from file://).
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
});
