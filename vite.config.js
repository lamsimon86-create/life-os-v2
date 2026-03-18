import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'
import fs from 'fs'
import path from 'path'

// Custom plugin: copy dist/index.html → dist/404.html for GitHub Pages SPA routing
function copy404Plugin() {
  return {
    name: 'copy-404',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const src = path.join(distDir, 'index.html')
      const dest = path.join(distDir, '404.html')
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
        console.log('Copied dist/index.html → dist/404.html for GitHub Pages SPA routing')
      }
    }
  }
}

export default defineConfig({
  base: '/life-os/',

  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Life OS',
        short_name: 'Life OS',
        description: 'AI-powered personal operating system',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/life-os/',
        icons: [
          {
            src: '/life-os/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    copy404Plugin()
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
