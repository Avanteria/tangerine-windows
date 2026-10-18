import { motion } from 'framer-motion'
import { Check, X, AlertTriangle } from 'lucide-react'

interface Props {
  phase: 'running' | 'done' | 'error'
  percent: number | null
  label: string
  onCancel: () => void
}

const R = 30
const C = 2 * Math.PI * R

/** The small, non-intrusive progress ring left on screen while a conversion runs. */
export function ProgressCore({ phase, percent, label, onCancel }: Props) {
  const indeterminate = phase === 'running' && percent === null
  const value = phase === 'done' ? 100 : (percent ?? 25)
  return (
    <motion.div className={`progress-core is-${phase}`} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      <svg width={84} height={84} viewBox="0 0 84 84" className={indeterminate ? 'spin' : ''}>
        <circle cx={42} cy={42} r={R} className="track" />
        <circle
          cx={42} cy={42} r={R} className="bar"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - value / 100)}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="progress-center">
        {phase === 'done' && <Check size={22} strokeWidth={2.5} />}
        {phase === 'error' && <AlertTriangle size={20} />}
        {phase === 'running' && (
          <>
            <span className="pct">{percent === null ? '' : `${Math.round(percent)}%`}</span>
            <button className="cancel" onClick={onCancel} title="Cancel" aria-label="Cancel conversion">
              <X size={14} />
            </button>
          </>
        )}
      </div>
      <div className="progress-label" title={label}>{label}</div>
    </motion.div>
  )
}
