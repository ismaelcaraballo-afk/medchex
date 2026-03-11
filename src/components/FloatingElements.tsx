import { motion } from 'framer-motion'

interface FloatingElementProps {
  delay?: number
  duration?: number
  color?: string
  size?: string
}

const FloatingRx = ({ delay = 0, duration = 4, color = '#D4AF37', size = 'text-4xl' }: FloatingElementProps) => {
  return (
    <motion.div
      animate={{
        y: [0, -30, 0],
        opacity: [0.3, 0.6, 0.3],
        rotate: [0, 5, -5, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`absolute ${size} font-bold pointer-events-none`}
      style={{ color }}
    >
      Rx
    </motion.div>
  )
}

export const FloatingElementsBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Top left */}
      <FloatingRx delay={0} duration={5} color="#D4AF37" size="text-5xl" />
      <motion.div
        className="absolute top-16 left-20 text-3xl opacity-20"
        style={{ color: '#003F7F' }}
        animate={{ y: [0, -25, 0] }}
        transition={{ duration: 6, delay: 0.5, repeat: Infinity }}
      >
        ✓
      </motion.div>

      {/* Top right */}
      <FloatingRx delay={1} duration={4.5} color="#4CAF50" size="text-4xl" />
      <motion.div
        className="absolute top-32 right-32 text-2xl opacity-20"
        style={{ color: '#D4AF37' }}
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 5, delay: 0.2, repeat: Infinity }}
      >
        Rx
      </motion.div>

      {/* Middle left */}
      <FloatingRx delay={0.5} duration={5.5} color="#003F7F" size="text-3xl" />
      <motion.div
        className="absolute top-1/2 right-16 text-4xl opacity-20"
        style={{ color: '#4CAF50' }}
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 6, delay: 1, repeat: Infinity }}
      >
        ✓
      </motion.div>

      {/* Bottom elements */}
      <FloatingRx delay={1.5} duration={4} color="#4CAF50" size="text-3xl" />
      <motion.div
        className="absolute bottom-20 left-1/3 text-2xl opacity-20"
        style={{ color: '#D4AF37' }}
        animate={{ y: [0, -25, 0] }}
        transition={{ duration: 5.5, delay: 1.5, repeat: Infinity }}
      >
        Rx
      </motion.div>
    </div>
  )
}

export default FloatingRx
