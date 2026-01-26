// src/config/languageConfig.js

// An object for key-value lookups (used by LanguageSelector.vue)
export const localeNames = {
  ar: 'Arabic',
  en: 'English',
  de: 'German',
  es: 'Spanish',
  fr: 'Français',
  id: 'Indonesian',
  pt: 'Portuguese',
  ro: 'Română',
  ru: 'Russian',
  th: 'Thai',
  zh: 'Chinese'
};

// An array of objects for iterating and creating UI elements (used by AdminDashboard.vue)
export const availableLanguages = [
  { code: 'ar', name: 'Arabic' },
  { code: 'de', name: 'German' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'Français' },
  { code: 'id', name: 'Indonesian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Română' },
  { code: 'ru', name: 'Russian' },
  { code: 'th', name: 'Thai' },
  { code: 'zh', name: 'Chinese' }
];