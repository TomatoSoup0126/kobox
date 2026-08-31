import { createApp } from 'vue'
import ShareApp from './ShareApp.vue'
import i18n from '../i18n/index.js'

// 語言偵測已收斂到 i18n/index.js，popup 與分享頁共用同一套規則。
const app = createApp(ShareApp)
app.use(i18n)
app.mount('#app')
