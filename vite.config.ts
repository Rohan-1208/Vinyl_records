import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Serve the frontend directory as Vite root so index.html is discovered
      root: path.resolve(__dirname, 'frontend'),
      // Load env files from repo root even though root is 'frontend'
      envDir: __dirname,
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'https://vinyl-records.onrender.com',
            changeOrigin: true,
            secure: false,
          },
          '/auth': {
            target: 'https://vinyl-records.onrender.com',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg', 'logo.png', 'logo-192.png', 'logo-512.png'],
          manifest: {
            name: 'Vinyl Records',
            short_name: 'Vinyl Records',
            description: 'Minimalist vinyl records player with Spotify integration',
            start_url: '/',
            scope: '/',
            display: 'fullscreen',
            display_override: ['fullscreen', 'window-controls-overlay', 'standalone'],
            background_color: '#000000',
            theme_color: '#0b1120',
            icons: [
              {
                src: '/logo-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/logo-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: '/favicon.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
