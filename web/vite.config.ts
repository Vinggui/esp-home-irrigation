import { defineConfig } from 'vite'
// import liveReload from 'vite-plugin-live-reload'
import react from '@vitejs/plugin-react'
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  plugins: [
    react({
      include: "**/*.tsx",
    }),
    // liveReload('**/*.tsx'),
  ],
  server: {
    port: 3000,
    watch: {
      usePolling: true,
      // interval: 100, // 100ms polling interval
    },
    hmr: {
      host: 'localhost', // or use your WSL IP if accessing from Windows browser
      protocol: 'ws',
      port: 3000,
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../data'), // write build to ../data
    emptyOutDir: false,                          // must be false for outDir outside project root
    assetsDir: 'assets'
  }
})
