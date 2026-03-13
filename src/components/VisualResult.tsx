/**
 * VisualResult — Literacy-independent severity display
 *
 * Designed for users who may not read in any language:
 * - Nahuatl speakers from rural Mexico with no formal schooling
 * - Any language + low literacy combination
 *
 * Communication is purely visual: color, size, symbol, and optionally audio.
 * No reading required to understand SAFE / CAUTION / DANGEROUS.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PharmacistCard from './PharmacistCard'

// Only these codes have reliable speech synthesis support across browsers.
// Fallback to 'en' if the current language isn't in the list.
const VALID_SPEECH_LANGS = new Set(['en','es','zh','hi','ar','bn','pt','ru','fr','ur','yi','nah'])

interface VisualResultProps {
  severity: string
  drugs: string[]
  explanation: string
}

const VISUAL_CONFIG = {
  SAFE: {
    symbol: '✓',
    emoji: '🟢',
    bg: '#052e16',
    color: '#22c55e',
    border: '#16a34a',
    size: '6rem',
    // Simple universal symbols — understood without reading
    icon: '👍',
    // Audio description for screen readers / read-aloud
    audioText: (drugs: string[]) =>
      `${drugs.join(' and ')} can be taken together. This combination is safe.`,
  },
  CAUTION: {
    symbol: '⚠',
    emoji: '🟡',
    bg: '#2d1a00',
    color: '#f59e0b',
    border: '#d97706',
    size: '6rem',
    icon: '✋',
    audioText: (drugs: string[]) =>
      `Warning. ${drugs.join(' and ')} may interact. Talk to your pharmacist or doctor before taking these together.`,
  },
  DANGEROUS: {
    symbol: '✕',
    emoji: '🔴',
    bg: '#2d0a0a',
    color: '#ef4444',
    border: '#dc2626',
    size: '6rem',
    icon: '🚫',
    audioText: (drugs: string[]) =>
      `STOP. Do not take ${drugs.join(' and ')} together. This combination is dangerous. Call your doctor or pharmacist right now.`,
  },
}

// Haptic patterns — felt without sound, works even in silent mode
const HAPTIC = {
  SAFE:      [200],                    // single gentle pulse
  CAUTION:   [200, 100, 200],          // double pulse
  DANGEROUS: [100, 80, 100, 80, 100],  // three rapid pulses
}

export default function VisualResult({ severity, drugs, explanation }: VisualResultProps) {
  const { i18n } = useTranslation()
  const config = VISUAL_CONFIG[severity as keyof typeof VISUAL_CONFIG] ?? VISUAL_CONFIG.CAUTION
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showPharmacist, setShowPharmacist] = useState(false)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false)

  // Haptic feedback on result load — felt without reading or hearing
  useEffect(() => {
    const pattern = HAPTIC[severity as keyof typeof HAPTIC]
    if (pattern) navigator.vibrate?.(pattern)
  }, [severity])

  // Auto-play audio when result appears — non-readers don't need to find the button
  useEffect(() => {
    if (!autoPlayEnabled) return
    // Small delay so the visual renders first, then audio follows
    const timer = setTimeout(() => speak(), 600)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [severity, autoPlayEnabled])

  // Stop any playing speech when component unmounts
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  const speak = () => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const text = explanation || config.audioText(drugs)
    const utterance = new SpeechSynthesisUtterance(text)

    // Validate language code before passing to browser speech engine.
    // An unrecognized lang code can cause silent failure or wrong voice selection.
    const baseLang = i18n.language.split('-')[0]
    utterance.lang = VALID_SPEECH_LANGS.has(baseLang) ? i18n.language : 'en'
    utterance.rate = 0.85   // slightly slower — clearer for non-native speakers
    utterance.pitch = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }

  return (
    <div className="visual-result" style={{ borderColor: config.border, backgroundColor: config.bg }}>

      {/* Giant symbol — understood without reading */}
      <div className="visual-symbol" style={{ color: config.color, fontSize: config.size }}>
        {config.icon}
      </div>

      {/* Severity text — large, bold, colored */}
      <div className="visual-severity-text" style={{ color: config.color }}>
        {config.symbol} {severity}
      </div>

      {/* Drug names — tap any pill to hear it spoken aloud */}
      <div className="visual-drugs">
        {drugs.map((drug, i) => (
          <button
            key={i}
            className="visual-drug-pill visual-drug-pill-btn"
            onClick={() => {
              if (!window.speechSynthesis) return
              window.speechSynthesis.cancel()
              const u = new SpeechSynthesisUtterance(drug)
              const baseLang = i18n.language.split('-')[0]
              u.lang = VALID_SPEECH_LANGS.has(baseLang) ? i18n.language : 'en'
              u.rate = 0.85
              window.speechSynthesis.speak(u)
            }}
            aria-label={`Tap to hear: ${drug}`}
            title="Tap to hear this drug name"
            type="button"
          >
            🔉 {drug}
          </button>
        ))}
      </div>

      {/* Audio + pharmacist card controls */}
      <div className="visual-audio-controls">
        <button
          className="audio-btn audio-btn-play"
          onClick={speak}
          aria-label={isSpeaking ? 'Reading aloud — tap to stop' : 'Read result aloud'}
          aria-pressed={isSpeaking}
          title="Read result aloud"
        >
          {isSpeaking ? '🔊' : '🔈'}
        </button>
        <button
          className="audio-btn audio-btn-stop"
          onClick={stopSpeaking}
          aria-label="Stop reading"
          title="Stop"
        >
          ⏹
        </button>
        <button
          className="audio-btn audio-btn-autoplay"
          onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
          aria-label="Auto-play audio on/off"
          aria-pressed={autoPlayEnabled}
          title="Toggle auto-play"
          type="button"
        >
          {autoPlayEnabled ? '🔔' : '🔕'}
        </button>
        <button
          className="audio-btn pharmacist-btn"
          onClick={() => setShowPharmacist(true)}
          aria-label="Show pharmacist card"
          title="Show this to your pharmacist"
          type="button"
        >
          💊
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
