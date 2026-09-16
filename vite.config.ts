import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MiB limit to allow caching
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
      },
      manifest: {
        name: 'Agromercantil Logística',
        short_name: 'Agromercantil',
        description: 'Sistema de Gestão Logística Agromercantil',
        theme_color: '#16A34A',
        background_color: '#060A14',
        display: 'standalone',
        icons: [
          {
            src: '/icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas', 'dompurify'],
          'vendor-icons': ['lucide-react']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
