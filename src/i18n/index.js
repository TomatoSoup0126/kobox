import { createI18n } from 'vue-i18n'
import zhTW from '../locales/zh-TW.json'
import enUS from '../locales/en-US.json'

const getStoredLocale = () => {
  try {
    const stored = localStorage.getItem('kobo-slash-locale')
    return stored || 'en-US'
  } catch (error) {
    return 'en-US'
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
