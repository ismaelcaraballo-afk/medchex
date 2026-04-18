/**
 * PharmacistCard — a "show this to your pharmacist" overlay
 *
 * For non-readers: they can tap a button and show their phone screen to
 * a pharmacist who will immediately understand what was checked.
 * The patient doesn't need to say or read anything.
 *
 * Always rendered in English regardless of app language —
 * pharmacists in US speak English even when patients don't.
 */

import { useEffect, useRef } from 'react'

interface PharmacistCardProps {
  drugs: string[]
  severity: string
  onClose: () => void
}

const SEVERITY_COLOR = {
  SAFE:      { bg: '#052e16', border: '#16a34a', text: '#22c55e' },
  CAUTION:   { bg: '#2d1a00', border: '#d97706', text: '#f59e0b' },
  DANGEROUS: { bg: '#2d0a0a', border: '#dc2626', text: '#ef4444' },
}

const SEVERITY_LABEL = {
  SAFE:      '✓ SAFE to take together',
  CAUTION:   '⚠ USE CAUTION — please advise',
  DANGEROUS: '🚫 DANGEROUS — do not take together',
}

export default function PharmacistCard({ drugs, severity, onClose }: PharmacistCardProps) {
  const colors = SEVERITY_COLOR[severity as keyof typeof SEVERITY_COLOR] ?? SEVERITY_COLOR.CAUTION
  const label  = SEVERITY_LABEL[severity as keyof typeof SEVERITY_LABEL] ?? severity
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="pharmacist-overlay" role="dialog" aria-modal="true" aria-label="Pharmacist card">
      <div className="pharmacist-card" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>

        <p className="pharmacist-from">My patient is asking about:</p>

        <div className="pharmacist-drugs">
          {drugs.map((drug, i) => (
            <span key={i} className="pharmacist-drug-pill">{drug}</span>
          ))}
        </div>

        <div className="pharmacist-verdict" style={{ color: colors.text }}>
          {label}
        </div>

        <p className="pharmacist-source">
          Source: FDA FAERS + NIH RxNorm · MedRxChex
        </p>

        <button
          ref={closeButtonRef}
          className="pharmacist-close-btn"
          onClick={onClose}
          aria-label="Close pharmacist card"
        >
          Close
        </button>
      </div>
    </div>
  )
}
