import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'audio' ||
              /\.(mp3|wav|flac|m4a|ogg)(\\?.*)?$/i.test(request.url) ||
              request.url.includes('/AUDIO/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'qdn-audio',
              expiration: {
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'document' ||
              request.headers.get('accept')?.includes('application/json') === true ||
              request.url.includes('/DOCUMENT/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'qdn-meta',
              expiration: {
                maxAgeSeconds: 7 * 24 * 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  base: ""
})
