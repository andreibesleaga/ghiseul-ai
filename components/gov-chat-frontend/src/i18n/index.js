import { createI18n } from 'vue-i18n'

// Dynamically import all locale files from the locales folder using Webpack's require.context
const localeContext = require.context('./locales', false, /\.js$/)
const messages = {}

// Iterate over all .js files in the locales folder
localeContext.keys().forEach((key) => {
  // Extract locale code from filename (e.g., './en.js' -> 'en')
  const locale = key.match(/\.\/([a-z]{2,3})\.js$/i)?.[1]
  if (locale && localeContext(key).default) {
    messages[locale] = localeContext(key).default
  } else {
    console.warn(`Invalid locale file or export: ${key}`)
  }
})

// Create i18n instance
const i18n = createI18n({
  legacy: true, // Enable legacy API for backwards compatibility
  locale: 'en', // Default locale
  fallbackLocale: 'en',
  messages
})

export default i18n