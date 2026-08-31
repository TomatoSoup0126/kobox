import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ command, mode }) => ({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [resolve(__dirname, 'src/locales/**')],
      strictMessage: false,
      escapeHtml: false
    }),
    {
      // content script 不是 ES module，任何 import/export 都會讓它在瀏覽器裡靜默失效。
      // rollup 只在模組被兩個以上 entry 共用時才拆 chunk，所以這裡守住這個前提。
      name: 'assert-content-scripts-are-self-contained',
      writeBundle(options) {
        const outDir = options.dir || 'dist'
        const contentScripts = ['content.js', 'share-bridge.js', 'kobo-inject.js']

        for (const name of contentScripts) {
          const file = path.join(outDir, name)
          if (!fs.existsSync(file)) continue

          const code = fs.readFileSync(file, 'utf8')
          if (/(^|\n)\s*(import|export)[\s{*]/.test(code)) {
            throw new Error(
              `${name} 含有模組語法，content script 無法載入。` +
              '請確認它 import 的模組沒有被其他 entry 共用而拆成獨立 chunk。'
            )
          }
        }
      }
    },
    {
      name: 'move-popup-html-and-copy-icons',
      writeBundle(options) {
        const outDir = options.dir || 'dist'
        const htmlSource = path.join(outDir, 'src/popup/popup.html')
        const htmlTarget = path.join(outDir, 'popup.html')
        
        if (fs.existsSync(htmlSource)) {
          let htmlContent = fs.readFileSync(htmlSource, 'utf8')
          
          htmlContent = htmlContent.replace(/(src|href)="\/([^"]+)"/g, '$1="./$2"')
          
          fs.writeFileSync(htmlTarget, htmlContent)
          
          fs.unlinkSync(htmlSource)
          try {
            fs.rmdirSync(path.join(outDir, 'src/popup'))
            const srcDir = path.join(outDir, 'src')
            if (fs.existsSync(srcDir) && fs.readdirSync(srcDir).length === 0) {
              fs.rmdirSync(srcDir)
            }
          } catch (_e) {
          }
        }

        const iconsSourceDir = path.join(__dirname, 'src/icons')
        const iconsTargetDir = path.join(outDir, 'icons')
        
        if (fs.existsSync(iconsSourceDir)) {
          if (!fs.existsSync(iconsTargetDir)) {
            fs.mkdirSync(iconsTargetDir, { recursive: true })
          }
          
          const iconFiles = fs.readdirSync(iconsSourceDir)
          iconFiles.forEach(file => {
            const sourcePath = path.join(iconsSourceDir, file)
            const targetPath = path.join(iconsTargetDir, file)
            fs.copyFileSync(sourcePath, targetPath)
          })
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content/content.js'),
        background: resolve(__dirname, 'src/background/background.js'),
        'share-bridge': resolve(__dirname, 'src/content/share-bridge.js'),
        'kobo-inject': resolve(__dirname, 'src/content/kobo-inject.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'popup' ? 'popup.js' : '[name].js'
        },
        chunkFileNames: '[name].js',
        assetFileNames: (_assetInfo) => {
          return '[name].[ext]'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: command === 'build'
  },
  worker: {
    format: 'es'
  }
}))
