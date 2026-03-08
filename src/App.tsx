import { useState } from 'react'
import DrugSearch from './components/DrugSearch'
import ResultCard from './components/ResultCard'
import { getRxCUI, getInteractions, scoreInteractions, explainInteractions, getFAERS } from './services/drugApi'
import './App.css'

interface CheckResult {
  drugs: string[]
  severity: string
  explanation: string
  interactions: { description: string }[]
  faersCount?: number
}

export default function App() {
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
        .map((r: { rxcui?: string }) => r.rxcui)
        .filter(Boolean) as string[]

      if (rxcuis.length < 2) {
        setError('Could not find one or more drugs in the RxNorm database. Check your spelling.')
        return
      }

      // Step 2: Get interactions
      const interactionData = await getInteractions(rxcuis)
      const pairs = interactionData.interactionPairs ?? []

      // Step 3: Score severity
      const scoreData = await scoreInteractions(pairs)
      const severity: string = scoreData.severity ?? 'SAFE'

      // Step 4: AI explanation
      const explainData = await explainInteractions(drugs, pairs, severity)
      const explanation: string = explainData.explanation ?? ''

      // Step 5: FAERS adverse event count
      const faersData = await getFAERS(drugs[0])
      const faersCount: number = faersData.total ?? 0

      setResult({ drugs, severity, explanation, interactions: pairs, faersCount })

    } catch (err) {
      setError('Something went wrong. Make sure the backend server is running on port 3001.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>MedChex</h1>
        <p>Drug interaction checker backed by FDA data</p>
      </header>

      <main className="app-main">
        <DrugSearch onCheck={handleCheck} loading={loading} />

        {error && (
          <div className="error-banner">{error}</div>
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
      </main>

      <footer className="app-footer">
        Data sources: NIH RxNorm · FDA FAERS · Anthropic Claude
      </footer>
    </div>
  )
}
