import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      include: [resolve(__dirname, 'src/locales/**')],
      strictMessage: false,
      escapeHtml: false
    }),
    {
      name: 'move-popup-html-and-copy-icons',
      writeBundle(options) {
        const outDir = options.dir || 'dist'
        const htmlSource = path.join(outDir, 'src/popup/popup.html')
        const htmlTarget = path.join(outDir, 'popup.html')
        
        if (fs.existsSync(htmlSource)) {
          let htmlContent = fs.readFileSync(htmlSource, 'utf8')
          
          htmlContent = htmlContent.replace(/src="\/popup\.js"/g, 'src="./popup.js"')
          htmlContent = htmlContent.replace(/href="\/popup\.css"/g, 'href="./popup.css"')
          
          fs.writeFileSync(htmlTarget, htmlContent)
          
          fs.unlinkSync(htmlSource)
          try {
            fs.rmdirSync(path.join(outDir, 'src/popup'))
            fs.rmdirSync(path.join(outDir, 'src'))
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
    sourcemap: false
  },
  worker: {
    format: 'es'
  }
})
