/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// Política de segurança aplicada apenas no build (o dev server do Vite injeta scripts inline).
// connect-src permite apenas a própria origem e o Hugging Face (download de modelos autorizados).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'arandu-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Caminho base: '/' localmente; no GitHub Pages o app fica em /Arandu/app/ (definido via ARANDU_BASE).
const base = process.env.ARANDU_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    cspPlugin(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ARANDU — Documentos para IA',
        short_name: 'ARANDU',
        description: 'Seus documentos. Menos tokens. Mais inteligência. Conversão local de documentos em Markdown otimizado para IA.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#04140f',
        theme_color: '#064e3b',
        categories: ['productivity', 'utilities', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell completo (inclui o worker do PDF.js). Binários pesados de OCR/IA ficam fora do
        // precache e só são baixados quando o usuário autoriza na Central de Modelos.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['vendor/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}vendor/tesseract/`),
            handler: 'CacheFirst',
            options: { cacheName: 'arandu-ocr-v1' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith(`${base}vendor/ort/`),
            handler: 'CacheFirst',
            options: { cacheName: 'arandu-ai-runtime-v1' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
