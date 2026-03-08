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
  SAFE:      { color: '#22c55e', bg: '#052e16', label: '✓ SAFE' },
  CAUTION:   { color: '#f59e0b', bg: '#2d1a00', label: '⚠ CAUTION' },
  DANGEROUS: { color: '#ef4444', bg: '#2d0a0a', label: '✕ DANGEROUS' },
}

export default function ResultCard({ drugs, severity, explanation, interactions, faersCount }: ResultCardProps) {
  const config = severityConfig[severity as keyof typeof severityConfig] ?? severityConfig.CAUTION

  return (
    <div className="result-card">

      {/* Severity badge */}
      <div className="severity-badge" style={{ backgroundColor: config.bg, borderColor: config.color }}>
        <span className="severity-label" style={{ color: config.color }}>
          {config.label}
        </span>
        <span className="severity-drugs">
          {drugs.join(' + ')}
        </span>
      </div>

      {/* AI explanation */}
      {explanation && (
        <div className="explanation">
          <h3>What This Means</h3>
          <p>{explanation}</p>
        </div>
      )}

      {/* Interaction list */}
      {interactions.length > 0 && (
        <div className="interactions">
          <h3>Known Interactions ({interactions.length})</h3>
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
          <span className="faers-count">{faersCount.toLocaleString()}</span> adverse event reports
          in the FDA FAERS database for these medications
        </div>
      )}

      <p className="disclaimer">
        This tool provides information only. Always consult a healthcare provider before changing medications.
      </p>
    </div>
  )
}
