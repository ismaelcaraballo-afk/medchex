/**
 * LoadingBar — real-time 5-step progress indicator
 *
 * Shows each API call as it fires, filling the bar step by step.
 * Step dots light up as each call completes. Current step animates.
 */
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const STEP_ICONS = ['💊', '🔍', '⚖️', '🤖', '📋']
const STEP_KEYS = [
  'search.step_lookup',
  'search.step_interactions',
  'search.step_scoring',
  'search.step_explanation',
  'search.step_adverse',
]

interface LoadingBarProps {
  step: number  // 1–5 = active step; 0 = idle
}

export default function LoadingBar({ step }: LoadingBarProps) {
  const { t } = useTranslation()
  // Bar fills 20% per step — reaches 100% when step 5 completes
  const progress = (step / STEP_KEYS.length) * 100
  const currentIcon  = step > 0 && step <= STEP_KEYS.length ? STEP_ICONS[step - 1] : null
  const currentLabel = step > 0 && step <= STEP_KEYS.length ? t(STEP_KEYS[step - 1]) : null

  return (
    <div className="loading-bar-container">

      {/* Step dots */}
      <div className="lbd-dots">
        {STEP_KEYS.map((key, i) => {
          const isDone    = step > i + 1
          const isCurrent = step === i + 1
          return (
            <div
              key={i}
              className={`lbd-dot ${isDone ? 'lbd-done' : ''} ${isCurrent ? 'lbd-active' : ''}`}
              title={t(key)}
            >
              {isDone ? '✓' : i + 1}
            </div>
          )
        })}
      </div>

      {/* Progress track */}
      <div className="lbd-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="lbd-fill"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        {/* Glow shimmer on leading edge */}
        <motion.div
          className="lbd-glow"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: `${Math.min(progress + 4, 100)}%` }}
        />
      </div>

      {/* Current step label */}
      {currentLabel && (
        <motion.div
          key={step}
          className="lbd-label"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span>{currentIcon}</span>
          <span>{currentLabel}</span>
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          >
            …
          </motion.span>
        </motion.div>
      )}

    </div>
  )
}
