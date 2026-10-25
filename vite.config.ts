import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app that quizzes offline (SPEC §8). The app shell is
    // precached; word lists and fonts are cached as they're fetched.
    VitePWA({
      // A new version waits until the person reloads from the update banner,
      // so a deploy never reloads the page in the middle of a session.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Level Vocab',
        short_name: 'Level Vocab',
        description: 'Quiz yourself on vocabulary, one level at a time.',
        theme_color: '#16213a',
        background_color: '#f3f5f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/data\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The small language index is checked on every load, so an updated
            // word list shows without an app update; offline the last copy is used.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/data/languages.json',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'word-index',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Word lists are addressed by a content fingerprint (es.json?v=<hash>),
            // so a saved copy never goes stale: it's used without asking the
            // server, and a list is downloaded again only when its contents change.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'word-lists',
              expiration: { maxEntries: 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
})
