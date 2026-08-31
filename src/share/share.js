import { createApp } from 'vue'
import ShareApp from './ShareApp.vue'
import i18n from '../i18n/index.js'

if (typeof navigator !== 'undefined') {
  try {
    if (!localStorage.getItem('kobo-slash-locale') && navigator.language?.toLowerCase().startsWith('zh')) {
      i18n.global.locale.value = 'zh-TW'
    }
  } catch {
    // ignore storage access issues
  }
}

const app = createApp(ShareApp)
app.use(i18n)
app.mount('#app')
