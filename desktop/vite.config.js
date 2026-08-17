import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.js',
      },
      preload: {
        input: 'src/preload/index.js',
      },
      renderer: {},
    }),
  ],
});
