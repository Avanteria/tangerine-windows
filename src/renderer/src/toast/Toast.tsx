import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ToastPayload } from '@shared/types'

const api = window.tangerine

export function Toast() {
  const [t, setT] = useState<ToastPayload | null>(null)
  useEffect(() => api.onToast((p) => {
    document.documentElement.dataset.theme = p.dark ? 'dark' : 'light'
    setT(p)
  }), [])

  const act = () => {
    if (!t?.action) return
    if (t.action.kind === 'open-logs') api.openLogs()
    if (t.action.kind === 'show-item' && t.action.target) api.showItem(t.action.target)
    if (t.action.kind === 'open-url' && t.action.target) api.openUrl(t.action.target)
    api.closeToast()
  }

  const LevelIcon = t?.level === 'error' ? AlertCircle : t?.level === 'success' ? CheckCircle2 : Info

  return (
    <AnimatePresence>
      {t && (
        <motion.div key={t.id} className={`toast toast-${t.level}`} role="status" aria-live="polite"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
          <LevelIcon size={20} className="toast-icon" />
          <div className="toast-text">
            <strong>{t.title}</strong>
            {t.message && <span title={t.message}>{t.message}</span>}
          </div>
          {t.action && <button className="btn btn-sm btn-accent" onClick={act}>{t.action.label}</button>}
          <button className="toast-close" aria-label="Dismiss" onClick={() => api.closeToast()}><X size={14} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
