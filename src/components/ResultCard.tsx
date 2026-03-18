import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PharmacistCard from './PharmacistCard'

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
  SAFE:      { color: '#4CAF50', bg: '#0d3a1a' },
  CAUTION:   { color: '#D4AF37', bg: '#3a2d0a' },
  DANGEROUS: { color: '#ef4444', bg: '#2d0a0a' },
}

export default function ResultCard({ drugs, severity, explanation, interactions, faersCount }: ResultCardProps) {
  const { t } = useTranslation()
  const [showPharmacist, setShowPharmacist] = useState(false)
  const config = severityConfig[severity as keyof typeof severityConfig] ?? severityConfig.CAUTION
  const severityLabel = t(`severity.${severity}`, severity)

  // Web Share API for mobile "save to phone" — falls back to print on desktop
  const handleSave = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MedRxChex: ${drugs.join(' + ')}`,
          text: [
            `Drug Interaction Check`,
            `Medications: ${drugs.join(' + ')}`,
            `Result: ${severity}`,
            '',
            explanation,
            '',
            `⚕ For information purposes only. Contact your physician for medical advice.`,
            `Data: NIH RxNorm · FDA FAERS · Anthropic Claude`,
          ].join('\n'),
        })
      } catch {
        // User cancelled or share failed — fall back to print
        window.print()
      }
    } else {
      window.print()
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

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
              <li key={`${interaction.description.slice(0, 40)}-${i}`} className="interaction-item">
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

      {/* Action buttons */}
      <div className="result-actions no-print">
        <button className="print-btn" onClick={() => setShowPharmacist(true)}>
          💊 Show Pharmacist
        </button>
        <button className="print-btn" onClick={handleSave}>
          {canShare ? '📱 Save / Share' : '🖨 Print / Save PDF'}
        </button>
      </div>

      {showPharmacist && (
        <PharmacistCard
          drugs={drugs}
          severity={severity}
          onClose={() => setShowPharmacist(false)}
        />
      )}
    </div>
  )
}
