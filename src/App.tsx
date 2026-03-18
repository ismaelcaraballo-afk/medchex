import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import DrugSearch from './components/DrugSearch'
import ResultCard from './components/ResultCard'
import VisualResult from './components/VisualResult'
import LanguageSwitcher from './components/LanguageSwitcher'
import LoadingBar from './components/LoadingBar'
import { FloatingElementsBackground } from './components/FloatingElements'
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

// Visual-first mode: shown for ALL languages — color/symbol is universally useful regardless of literacy.
// ResultCard still renders below for full text details.

const DISCLAIMER = '⚕ This site does not cure, treat or diagnose. For information purposes only. Contact your physician for medical advice. \u00a0\u00a0\u00a0 ⚕ MedRxChex provides drug interaction data from NIH RxNorm and FDA FAERS. Always consult your healthcare provider before changing medications. \u00a0\u00a0\u00a0 ⚕ This site does not cure, treat or diagnose. For information purposes only. Contact your physician for medical advice. \u00a0\u00a0\u00a0'

export default function App() {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)

  // Re-fetch explanation in the new language when the user switches language mid-result.
  // On failure (e.g. DEMO_MODE + non-English), clear explanation so the card hides it
  // gracefully — TTS still works via the translated t('audio.*') strings.
  useEffect(() => {
    if (!result) return
    explainInteractions(result.drugs, result.interactions, result.severity, i18n.language)
      .then(data => setResult(prev => prev ? { ...prev, explanation: data.explanation ?? '' } : null))
      .catch(() => setResult(prev => prev ? { ...prev, explanation: '' } : null))
  }, [i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheck = async (drugs: string[]) => {
    if (loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setLoadingStep(1)

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
      setLoadingStep(2)
      const interactionData = await getInteractions(rxcuis)
      const pairs = interactionData.fullInteractionTypeGroup
        ?.flatMap((g: any) => g.fullInteractionType ?? [])
        ?.flatMap((iType: any) => iType.interactionPair ?? []) ?? []

      // Step 3: Score severity
      setLoadingStep(3)
      const scoreData = await scoreInteractions(pairs)
      // Get highest severity from scored array (priority: DANGEROUS > CAUTION > SAFE)
      const severityPriority = { DANGEROUS: 3, CAUTION: 2, SAFE: 1 }
      const severity: string = scoreData.scored?.reduce((max: string, item: any) => {
        const itemPriority = severityPriority[item.severity as keyof typeof severityPriority] || 0
        const maxPriority = severityPriority[max as keyof typeof severityPriority] || 0
        return itemPriority > maxPriority ? item.severity : max
      }, 'SAFE') ?? 'SAFE'

      // Step 4: AI explanation — pass language so Claude responds in it
      setLoadingStep(4)
      const explainData = await explainInteractions(drugs, pairs, severity, i18n.language)
      const explanation: string = explainData.explanation ?? ''

      // Step 5: FAERS adverse event count
      setLoadingStep(5)
      const faersData = await getFAERS(drugs[0])
      const faersCount: number = faersData.total ?? faersData.meta?.results?.total ?? 0

      setResult({ drugs, severity, explanation, interactions: pairs, faersCount })

    } catch (err) {
      const isNetwork = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))
      setError(t(isNetwork ? 'error.network' : 'error.api'))
      console.error(err)
    } finally {
      setLoading(false)
      setLoadingStep(0)
    }
  }

  const lang = i18n.language.split('-')[0]
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'

  return (
    <div className="app" dir={dir}>
      <FloatingElementsBackground />

      <header className="app-header">
        <div className="app-header-top">
          <LanguageSwitcher />
        </div>
        <div className="app-logo-container">
          <img src="/medRxchex-logo.jpg" alt="MedRxChex Logo" className="app-logo" />
        </div>
        <p className="app-tagline">Your MedRx Discovery Card.</p>
        <h1>MedRxChex</h1>
      </header>

      <main className="app-main">
        <DrugSearch onCheck={handleCheck} loading={loading} />

        {/* aria-live: screen readers announce errors without user navigating */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="error-banner" role="alert">{error}</div>
          )}
        </div>

        {/* Real-time step loading bar — replaces old spinner */}
        {loading && (
          <div aria-label="Checking interactions…" aria-live="polite">
            <LoadingBar step={loadingStep} />
          </div>
        )}

        {/* Results region — VisualResult (color/symbol) always on top, full details below */}
        <div aria-live="polite" aria-atomic="false">
          {result && (
            <VisualResult
              severity={result.severity}
              drugs={result.drugs}
              explanation={result.explanation}
            />
          )}

          {result && (
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

      {/* Disclaimer ticker — fixed at bottom of every view */}
      <div className="disclaimer-ticker" role="note" aria-label="Medical disclaimer" aria-live="off">
        <div className="disclaimer-ticker-inner">
          <span className="disclaimer-ticker-text">{DISCLAIMER}</span>
          <span className="disclaimer-ticker-text" aria-hidden="true">{DISCLAIMER}</span>
        </div>
      </div>
    </div>
  )
}
