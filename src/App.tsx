import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DrugSearch from './components/DrugSearch'
import ResultCard from './components/ResultCard'
import VisualResult from './components/VisualResult'
import LanguageSwitcher from './components/LanguageSwitcher'
import { getRxCUI, getInteractions, scoreInteractions, explainInteractions, getFAERS } from './services/drugApi'
import { RTL_LANGS } from './i18n'
import './App.css'

interface CheckResult {
  drugs: string[]
  severity: string
  explanation: string
  interactions: { description: string }[]
  faersCount?: number
}

// Visual-first mode: Nahuatl only — non-literate speakers who may not read any script.
// All other languages (including Arabic, Hindi, Urdu) get the full ResultCard with optional audio.
const VISUAL_FIRST_LANGS = new Set(['nah'])

export default function App() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)

  const handleCheck = async (drugs: string[]) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Step 1: Resolve each drug name to RxCUI
      const rxcuiResults = await Promise.all(drugs.map(d => getRxCUI(d)))
      const rxcuis = rxcuiResults
        .map((r: any) => r?.idGroup?.rxnormId?.[0])
        .filter(Boolean) as string[]

      if (rxcuis.length < 2) {
        setError(t('error.not_found'))
        return
      }

      // Step 2: Get interactions
      const interactionData = await getInteractions(rxcuis)
      const pairs = interactionData.fullInteractionTypeGroup
        ?.flatMap((g: any) => g.fullInteractionType ?? [])
        ?.flatMap((t: any) => t.interactionPair ?? []) ?? []

      // Step 3: Score severity
      const scoreData = await scoreInteractions(pairs)
      // Get highest severity from scored array (priority: DANGEROUS > CAUTION > SAFE)
      const severityPriority = { DANGEROUS: 3, CAUTION: 2, SAFE: 1 }
      const severity: string = scoreData.scored?.reduce((max: string, item: any) => {
        const itemPriority = severityPriority[item.severity as keyof typeof severityPriority] || 0
        const maxPriority = severityPriority[max as keyof typeof severityPriority] || 0
        return itemPriority > maxPriority ? item.severity : max
      }, 'SAFE') ?? 'SAFE'

      // Step 4: AI explanation — pass language so Claude responds in it
      const explainData = await explainInteractions(drugs, pairs, severity, i18n.language)
      const explanation: string = explainData.explanation ?? ''

      // Step 5: FAERS adverse event count
      const faersData = await getFAERS(drugs[0])
      const faersCount: number = faersData.total ?? 0

      setResult({ drugs, severity, explanation, interactions: pairs, faersCount })

    } catch (err) {
      const isNetwork = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))
      setError(t(isNetwork ? 'error.network' : 'error.api'))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const lang = i18n.language.split('-')[0]
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
  const visualFirst = useMemo(() => VISUAL_FIRST_LANGS.has(lang), [lang])

  return (
    <div className="app" dir={dir}>
      <header className="app-header">
        <div className="app-header-top">
          <LanguageSwitcher />
        </div>
        <h1>{t('header.title')}</h1>
        <p>{t('header.subtitle')}</p>
      </header>

      <main className="app-main">
        <DrugSearch onCheck={handleCheck} loading={loading} />

        {/* aria-live: screen readers announce errors and results without user navigating to them */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="error-banner" role="alert">{error}</div>
          )}
        </div>

        {/* Loading spinner — shown while API calls are in flight */}
        {loading && (
          <div className="loading-spinner" aria-label="Checking interactions…">
            <div className="spinner-ring" />
            <span>{t('search.checking')}</span>
          </div>
        )}

        {/* Results region — announced when content appears */}
        <div aria-live="polite" aria-atomic="false">
        {result && visualFirst && (
          <VisualResult
            severity={result.severity}
            drugs={result.drugs}
            explanation={result.explanation}
          />
        )}

        {result && !visualFirst && (
          <ResultCard
            drugs={result.drugs}
            severity={result.severity}
            explanation={result.explanation}
            interactions={result.interactions}
            faersCount={result.faersCount}
          />
        )}
        </div>
      </main>

      <footer className="app-footer">
        {t('footer')}
      </footer>
    </div>
  )
}
