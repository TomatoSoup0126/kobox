import { createI18n } from 'vue-i18n'
import zhTW from '../locales/zh-TW.json'
import enUS from '../locales/en-US.json'

// 沒有存過偏好時依瀏覽器語言決定。先前只有分享頁做這件事，導致中文使用者
// 看到中文分享頁卻是英文 popup。
const detectLocale = () => {
  const language = (typeof navigator !== 'undefined' && navigator.language) || ''
  return language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en-US'
}

const getStoredLocale = () => {
  try {
    return localStorage.getItem('kobo-slash-locale') || detectLocale()
  } catch (error) {
    return detectLocale()
  }
}

export const saveLocale = (locale) => {
  try {
    localStorage.setItem('kobo-slash-locale', locale)
  } catch (error) {
    console.warn('Unable to save locale preference:', error)
  }
}

const i18n = createI18n({
  legacy: false,
  locale: getStoredLocale(),
  fallbackLocale: 'zh-TW',
  globalInjection: true,
  allowComposition: true,
  messages: {
    'zh-TW': zhTW,
    'en-US': enUS
  }
})

export default i18n
