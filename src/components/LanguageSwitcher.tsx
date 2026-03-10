import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  return (
    <div className="lang-switcher">
      <label htmlFor="lang-select" className="lang-label">
        {t('language_label')}
      </label>
      <select
        id="lang-select"
        className="lang-select"
        value={i18n.language.split('-')[0]}
        onChange={e => !LANGUAGES.find(l => l.code === e.target.value)?.placeholder && i18n.changeLanguage(e.target.value)}
      >
        {LANGUAGES.map(({ code, label, placeholder }) => (
          <option key={code} value={code} disabled={placeholder}>
            {placeholder ? `${label} (coming soon)` : label}
          </option>
        ))}
      </select>
    </div>
  )
}
