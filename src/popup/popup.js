import { createApp } from 'vue'
import PopupApp from './PopupApp.vue'
import i18n from '../i18n/index.js'

const app = createApp(PopupApp)
app.use(i18n)
app.mount('#app')
