import i18next from 'i18next'
import en from '../locales/en/translations.json'
import ru from '../locales/ru/translations.json'

// if no language parameter is passed, let's try to use the node.js system's locale
const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale

i18next
  .init({
    fallbackLng: 'en',
    resources: {
      en: {
        translation: en
      },
      ru: {
        translation: ru
      }
    }
  })

export function i18n (lng: string | undefined) {
  return i18next.getFixedT(lng || systemLocale || 'en')
}
