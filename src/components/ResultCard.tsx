import { useTranslation } from 'react-i18next'

interface Interaction {
  description: string
  severity?: string
}

interface ResultCardProps {
  drugs: string[]
  severity: 'SAFE' | 'CAUTION' | 'DANGEROUS' | string
  explanation: string
  interactions: Interaction[]
  faersCount?: number
}

const severityConfig = {
  SAFE:      { color: '#22c55e', bg: '#052e16' },
  CAUTION:   { color: '#f59e0b', bg: '#2d1a00' },
  DANGEROUS: { color: '#ef4444', bg: '#2d0a0a' },
}

export default function ResultCard({ drugs, severity, explanation, interactions, faersCount }: ResultCardProps) {
  const { t } = useTranslation()
  const config = severityConfig[severity as keyof typeof severityConfig] ?? severityConfig.CAUTION
  const severityLabel = t(`severity.${severity}`, severity)

  const handlePrint = () => window.print()

  return (
    <div className="result-card" id="print-result">

      {/* Severity badge */}
      <div className="severity-badge" style={{ backgroundColor: config.bg, borderColor: config.color }}>
        <span className="severity-label" style={{ color: config.color }}>
          {severityLabel}
        </span>
        <span className="severity-drugs">
          {drugs.join(' + ')}
        </span>
      </div>

      {/* AI explanation */}
      {explanation && (
        <div className="explanation">
          <h3>{t('result.what_it_means')}</h3>
          <p>{explanation}</p>
        </div>
      )}

      {/* Interaction list */}
      {interactions.length > 0 && (
        <div className="interactions">
          <h3>{t('result.known_interactions', { count: interactions.length })}</h3>
          <ul>
            {interactions.map((interaction, i) => (
              <li key={i} className="interaction-item">
                {interaction.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FAERS data */}
      {faersCount !== undefined && (
        <div className="faers-note">
          {t('result.adverse_events', { count: faersCount })}
        </div>
      )}

      <p className="disclaimer">
        {t('result.disclaimer')}
      </p>

      {/* Print / Save button */}
      <button className="print-btn no-print" onClick={handlePrint}>
        🖨 Print / Save as PDF
      </button>
    </div>
  )
}
