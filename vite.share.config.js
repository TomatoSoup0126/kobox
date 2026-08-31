import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve } from 'path'

export default defineConfig({
  root: resolve(__dirname, 'src/share'),
  base: './',
  publicDir: resolve(__dirname, 'src/icons'),
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [resolve(__dirname, 'src/locales/**')],
      strictMessage: false,
      escapeHtml: false
    })
  ],
  build: {
    outDir: resolve(__dirname, 'dist-site'),
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 5174,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  }
})
