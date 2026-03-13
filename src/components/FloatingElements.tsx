import { motion } from 'framer-motion'

interface PillConfig {
  id: number
  width: number
  height: number
  gradient: string
  top?: string
  left?: string
  right?: string
  bottom?: string
  delay: number
  duration: number
  driftX: number
  driftY: number
  rotate: number
  opacity: number
}

// Two-tone pharmaceutical capsule pills — spread across the full viewport
const PILLS: PillConfig[] = [
  { id: 1,  width: 80,  height: 32, gradient: 'linear-gradient(90deg, #D4AF37 50%, #F5D169 50%)', top: '5%',  left: '3%',    delay: 0,   duration: 6,   driftX: 20,  driftY: -30, rotate: 12,  opacity: 0.6  },
  { id: 2,  width: 50,  height: 22, gradient: 'linear-gradient(90deg, #4CAF50 50%, #81C784 50%)', top: '12%', right: '5%',   delay: 0.8, duration: 5,   driftX: -15, driftY: -25, rotate: -8,  opacity: 0.55 },
  { id: 3,  width: 70,  height: 28, gradient: 'linear-gradient(90deg, #1E40AF 50%, #3B82F6 50%)', top: '25%', left: '8%',   delay: 1.5, duration: 7,   driftX: 10,  driftY: -35, rotate: 15,  opacity: 0.5  },
  { id: 4,  width: 60,  height: 24, gradient: 'linear-gradient(90deg, #7C3AED 50%, #A78BFA 50%)', top: '35%', right: '7%',  delay: 0.3, duration: 5.5, driftX: -20, driftY: -20, rotate: -10, opacity: 0.55 },
  { id: 5,  width: 90,  height: 36, gradient: 'linear-gradient(90deg, #BE185D 50%, #EC4899 50%)', top: '50%', left: '2%',   delay: 2,   duration: 6.5, driftX: 15,  driftY: -40, rotate: 8,   opacity: 0.5  },
  { id: 6,  width: 55,  height: 22, gradient: 'linear-gradient(90deg, #C2410C 50%, #F97316 50%)', top: '60%', right: '4%',  delay: 1.2, duration: 4.5, driftX: -10, driftY: -30, rotate: -15, opacity: 0.55 },
  { id: 7,  width: 75,  height: 30, gradient: 'linear-gradient(90deg, #0E7490 50%, #06B6D4 50%)', top: '72%', left: '6%',   delay: 0.5, duration: 6,   driftX: 25,  driftY: -25, rotate: 10,  opacity: 0.5  },
  { id: 8,  width: 65,  height: 26, gradient: 'linear-gradient(90deg, #B91C1C 50%, #EF4444 50%)', top: '80%', right: '8%',  delay: 1.8, duration: 5,   driftX: -12, driftY: -35, rotate: -12, opacity: 0.55 },
  { id: 9,  width: 48,  height: 20, gradient: 'linear-gradient(90deg, #D4AF37 50%, #003F7F 50%)', top: '88%', left: '15%',  delay: 2.5, duration: 7,   driftX: 8,   driftY: -20, rotate: 5,   opacity: 0.45 },
  { id: 10, width: 82,  height: 34, gradient: 'linear-gradient(90deg, #15803D 50%, #22C55E 50%)', top: '18%', left: '42%',  delay: 1,   duration: 5.5, driftX: -18, driftY: -30, rotate: -6,  opacity: 0.4  },
  { id: 11, width: 58,  height: 24, gradient: 'linear-gradient(90deg, #6D28D9 50%, #A855F7 50%)', top: '65%', right: '20%', delay: 3,   duration: 6,   driftX: 20,  driftY: -25, rotate: 18,  opacity: 0.5  },
  { id: 12, width: 44,  height: 18, gradient: 'linear-gradient(90deg, #B45309 50%, #F59E0B 50%)', top: '42%', right: '15%', delay: 0.7, duration: 4.8, driftX: -8,  driftY: -28, rotate: -20, opacity: 0.55 },
  { id: 13, width: 68,  height: 28, gradient: 'linear-gradient(90deg, #003F7F 50%, #D4AF37 50%)', top: '93%', right: '30%', delay: 2.2, duration: 6.2, driftX: 12,  driftY: -32, rotate: 7,   opacity: 0.45 },
  { id: 14, width: 52,  height: 21, gradient: 'linear-gradient(90deg, #4CAF50 50%, #D4AF37 50%)', top: '8%',  left: '35%',  delay: 1.6, duration: 5.8, driftX: -22, driftY: -22, rotate: -14, opacity: 0.5  },
  { id: 15, width: 62,  height: 25, gradient: 'linear-gradient(90deg, #0F766E 50%, #2DD4BF 50%)', top: '30%', left: '50%',  delay: 2.8, duration: 6.8, driftX: 14,  driftY: -32, rotate: 9,   opacity: 0.4  },
  { id: 16, width: 46,  height: 19, gradient: 'linear-gradient(90deg, #9F1239 50%, #FB7185 50%)', top: '55%', left: '30%',  delay: 0.4, duration: 5.2, driftX: -16, driftY: -26, rotate: -11, opacity: 0.45 },
]

export const FloatingElementsBackground = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'fixed',
      inset: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
    }}
  >
    {PILLS.map(pill => (
      <motion.div
        key={pill.id}
        style={{
          position: 'absolute',
          width: pill.width,
          height: pill.height,
          borderRadius: 999,
          background: pill.gradient,
          top: pill.top,
          left: pill.left,
          right: pill.right,
          bottom: pill.bottom,
          boxShadow: '0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)',
        }}
        animate={{
          y: [0, pill.driftY, 0],
          x: [0, pill.driftX, 0],
          rotate: [-pill.rotate / 2, pill.rotate, -pill.rotate / 2],
          opacity: [pill.opacity * 0.5, pill.opacity, pill.opacity * 0.5],
        }}
        transition={{
          duration: pill.duration,
          delay: pill.delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
)

export default FloatingElementsBackground
