/**
 * LoadingBar — real-time 5-step progress indicator
 *
 * Shows each API call as it fires, filling the bar step by step.
 * Step dots light up as each call completes. Current step animates.
 */
import { motion } from 'framer-motion'

const STEPS = [
  { label: 'Looking up medications',   icon: '💊' },
  { label: 'Finding interactions',     icon: '🔍' },
  { label: 'Scoring severity',         icon: '⚖️' },
  { label: 'Generating explanation',   icon: '🤖' },
  { label: 'Checking adverse events',  icon: '📋' },
]

interface LoadingBarProps {
  step: number  // 1–5 = active step; 0 = idle
}

export default function LoadingBar({ step }: LoadingBarProps) {
  // Bar fills 20% per step — reaches 100% when step 5 completes
  const progress = (step / STEPS.length) * 100
  const currentStep = step > 0 && step <= STEPS.length ? STEPS[step - 1] : null

  return (
    <div className="loading-bar-container">

      {/* Step dots */}
      <div className="lbd-dots">
        {STEPS.map((s, i) => {
          const isDone    = step > i + 1
          const isCurrent = step === i + 1
          return (
            <div
              key={i}
              className={`lbd-dot ${isDone ? 'lbd-done' : ''} ${isCurrent ? 'lbd-active' : ''}`}
              title={s.label}
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
      {currentStep && (
        <motion.div
          key={step}
          className="lbd-label"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span>{currentStep.icon}</span>
          <span>{currentStep.label}</span>
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
