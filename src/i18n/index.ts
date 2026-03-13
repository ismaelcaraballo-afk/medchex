import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// MVP languages — loaded upfront, always available
import en  from './locales/en.json'
import es  from './locales/es.json'
import zh  from './locales/zh.json'
import hi  from './locales/hi.json'
import ar  from './locales/ar.json'
import bn  from './locales/bn.json'
import pt  from './locales/pt.json'
import ru  from './locales/ru.json'
import fr  from './locales/fr.json'
import ur  from './locales/ur.json'
import yi  from './locales/yi.json'
import nah from './locales/nah.json'

// Placeholder languages — lazy loaded only when selected, not in initial bundle
// This keeps the first page load smaller for users who never need these
const loadPlaceholder = async (code: string) => {
  try {
    const mod = await import(`./locales/${code}.json`)
    i18n.addResourceBundle(code, 'translation', mod.default ?? mod, true, true)
  } catch (err) {
    console.error(`[i18n] Failed to load placeholder language: ${code}`, err)
  }
}

export interface Language {
  code: string
  label: string
  rtl?: boolean
  placeholder?: boolean  // true = "coming soon", shown but disabled
}

// NYC-first language order for MVP
export const LANGUAGES: Language[] = [
  { code: 'en',  label: 'English' },
  { code: 'es',  label: 'Español' },
  { code: 'zh',  label: '中文' },
  { code: 'ru',  label: 'Русский' },
  { code: 'bn',  label: 'বাংলা' },
  { code: 'hi',  label: 'हिंदी' },
  { code: 'ar',  label: 'العربية',  rtl: true },
  { code: 'ur',  label: 'اردو',     rtl: true },
  { code: 'yi',  label: 'ייִדיש',   rtl: true },
  { code: 'fr',  label: 'Français' },
  { code: 'pt',  label: 'Português' },
  { code: 'nah', label: 'Nahuatl (Mexicano)' },
  // Placeholders — translated and ready, lazy-loaded when selected
  { code: 'ja',  label: '日本語',  placeholder: true },
  { code: 'de',  label: 'Deutsch', placeholder: true },
]

export const RTL_LANGS = new Set(
  LANGUAGES.filter(l => l.rtl).map(l => l.code)
)

export const PLACEHOLDER_LANGS = new Set(
  LANGUAGES.filter(l => l.placeholder).map(l => l.code)
)

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en:  { translation: en  },
      es:  { translation: es  },
      zh:  { translation: zh  },
      hi:  { translation: hi  },
      ar:  { translation: ar  },
      bn:  { translation: bn  },
      pt:  { translation: pt  },
      ru:  { translation: ru  },
      fr:  { translation: fr  },
      ur:  { translation: ur  },
      yi:  { translation: yi  },
      nah: { translation: nah },
    },
    // Nahuatl speakers are far more likely to have Spanish-speaking family
    // than English-speaking family — fall back to Spanish before English
    fallbackLng: {
      nah: ['es', 'en'],
      default: ['en'],
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Pre-warm placeholder languages in the background after initial load
// so they're available instantly if a user later selects them
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    loadPlaceholder('ja')
    loadPlaceholder('de')
  })
}

export { loadPlaceholder }
export default i18n
