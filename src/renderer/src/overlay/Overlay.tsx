/**
 * Overlay state machine.
 *
 *  hidden ──show(drag)──▶ armed (invisible, 1% alpha so it is a hit-testable drop target)
 *  armed ──dragenter(files)──▶ menu ──drop on action──▶ running ──▶ done | error ──▶ hidden
 *  menu/armed ──mouse released without a drop──▶ hidden
 *  hidden ──show(keyboard, files)──▶ menu (arrow keys / Enter / mouse click)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ACTIONS_BY_ID } from '@shared/actions'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { combineKinds, extFromMime, extOf, kindFromMime, kindFromPath, KIND_LABEL } from '@shared/fileKinds'
import type { DetectedKind, JobUpdate, Settings } from '@shared/types'
import { useDark } from '../lib/useDark'
import { buildMenu, hitTest, nodeAt, type MenuNode, type Target } from '../lib/menuModel'
import { RadialMenu } from './RadialMenu'
import { ProgressCore } from './ProgressCore'

type Phase = 'hidden' | 'armed' | 'menu' | 'running' | 'done' | 'error'

interface Detected {
  kind: DetectedKind
  ext: string | null
  count: number
}

const api = window.tangerine

export function Overlay() {
  const [, setDark] = useDark(true)
  const [phase, _setPhase] = useState<Phase>('hidden')
  const phaseRef = useRef<Phase>('hidden')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    _setPhase(p)
  }
  const [center, setCenter] = useState({ cx: 260, cy: 260 })
  const [mode, setMode] = useState<'drag' | 'keyboard'>('drag')
  const [ctrl, setCtrl] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [detected, setDetected] = useState<Detected>({ kind: 'unknown', ext: null, count: 1 })
  const [knownFiles, setKnownFiles] = useState<string[] | null>(null)
  const [hover, setHover] = useState<Target | null>(null)
  const [openGroup, setOpenGroup] = useState<number | null>(null)
  const [jobs, setJobs] = useState<Record<string, JobUpdate>>({})
  const [jobLabel, setJobLabel] = useState('')
  const batchJobs = useRef<string[]>([])
  const dropped = useRef(false)
  const hideTimer = useRef<number | null>(null)

  const model = useMemo(
    () => buildMenu(detected.kind, detected.ext, detected.count, settings),
    [detected, settings]
  )

  const hide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    setPhase('hidden')
    setHover(null)
    setOpenGroup(null)
    api.hideOverlay()
  }, [])

  const hideLater = useCallback((ms: number) => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(hide, ms)
  }, [hide])

  // ── Main-process events ────────────────────────────────────────────────
  useEffect(() => {
    const offShow = api.onOverlayShow((p) => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
      dropped.current = false
      batchJobs.current = []
      setJobs({})
      setCenter({ cx: p.cx, cy: p.cy })
      setMode(p.mode)
      setCtrl(p.ctrl)
      setSettings(p.settings)
      setDark(p.dark)
      setOpenGroup(null)
      if (p.files?.length) {
        const kind = combineKinds(p.files.map(kindFromPath))
        const exts = new Set(p.files.map(extOf))
        setKnownFiles(p.files)
        setDetected({ kind, ext: exts.size === 1 ? [...exts][0]! : null, count: p.files.length })
        setHover({ ring: 'main', index: 0 })
        setPhase('menu')
      } else {
        setKnownFiles(null)
        setHover(null)
        setPhase('armed')
      }
    })
    const offEnd = api.onDragEnded(() => {
      // Mouse released. If it was over a segment the drop event arrives right after; wait for it.
      window.setTimeout(() => {
        if (!dropped.current && (phaseRef.current === 'armed' || phaseRef.current === 'menu')) hide()
      }, 300)
    })
    const offSettings = api.onSettingsChanged(setSettings)
    return () => {
      offShow()
      offEnd()
      offSettings()
    }
  }, [hide, setDark])

  useEffect(
    () =>
      api.onJobUpdate((u) => {
        if (!batchJobs.current.includes(u.jobId)) return
        setJobs((prev) => {
          const next = { ...prev, [u.jobId]: u }
          const all = batchJobs.current.map((id) => next[id]).filter(Boolean) as JobUpdate[]
          const finished = all.length === batchJobs.current.length && all.every((j) => ['done', 'error', 'cancelled'].includes(j.status))
          if (finished) {
            if (all.some((j) => j.status === 'error')) {
              setPhase('error')
              hideLater(1400) // the main process shows a toast with "Open Logs"
            } else if (all.every((j) => j.status === 'cancelled')) {
              hide()
            } else {
              setPhase('done')
              hideLater(900)
            }
          }
          return next
        })
      }),
    [hide, hideLater]
  )

  // ── Execution ──────────────────────────────────────────────────────────
  const execute = useCallback(
    async (node: MenuNode | null, files: string[]) => {
      if (!node?.actionId || node.disabled || files.length === 0) return
      dropped.current = true
      const desc = ACTIONS_BY_ID.get(node.actionId)
      setJobLabel(files.length > 1 ? `${desc?.hint ?? ''} · ${files.length} files` : (desc?.hint ?? ''))
      setPhase('running')
      const res = await api.runAction({ actionId: node.actionId, files })
      if (!res.ok) {
        if (res.error === 'Cancelled.') return hide()
        setJobLabel(res.error)
        setPhase('error')
        api.compactOverlay()
        return hideLater(2600)
      }
      batchJobs.current = res.jobIds
      api.compactOverlay()
    },
    [hide, hideLater]
  )

  const activate = useCallback(
    (t: Target | null) => {
      const n = nodeAt(model, t, openGroup)
      if (!n) return
      if (n.children && t?.ring === 'main') {
        setOpenGroup(t.index)
        setHover({ ring: 'sub', index: 0 })
        return
      }
      if (knownFiles) void execute(n, knownFiles)
    },
    [model, openGroup, knownFiles, execute]
  )

  // ── Pointer (drag + click) ─────────────────────────────────────────────
  const updateHover = (clientX: number, clientY: number) => {
    const t = hitTest(model, clientX - center.cx, clientY - center.cy, openGroup)
    setHover(t)
    if (t?.ring === 'main') setOpenGroup(model.main[t.index]?.children ? t.index : null)
    else if (t?.ring === 'fav') setOpenGroup(null)
    return t
  }

  const detectFromDrag = (dt: DataTransfer) => {
    const items = Array.from(dt.items).filter((i) => i.kind === 'file')
    if (!items.length) return false
    const kinds = items.map((i) => kindFromMime(i.type))
    const exts = new Set(items.map((i) => extFromMime(i.type)))
    const ext = exts.size === 1 ? [...exts][0]! : null
    const kind = combineKinds(kinds)
    setDetected((d) => (d.kind === kind && d.ext === ext && d.count === items.length ? d : { kind, ext, count: items.length }))
    return true
  }

  const onDragOver = (e: React.DragEvent) => {
    if (phaseRef.current !== 'armed' && phaseRef.current !== 'menu') return
    if (!detectFromDrag(e.dataTransfer)) return
    e.preventDefault()
    // SAFETY: always accept as COPY. Shift+drag requests MOVE from Explorer; reporting MOVE
    // would let Explorer delete the source file after the drop.
    e.dataTransfer.dropEffect = 'copy'
    if (phaseRef.current === 'armed') setPhase('menu')
    updateHover(e.clientX, e.clientY)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (phaseRef.current !== 'menu') return
    const files = Array.from(e.dataTransfer.files).map((f) => api.getPathForFile(f)).filter(Boolean)
    const t = hitTest(model, e.clientX - center.cx, e.clientY - center.cy, openGroup)
    const n = nodeAt(model, t, openGroup)
    if (n?.actionId) void execute(n, files)
    else {
      dropped.current = true
      hide()
    }
  }

  // ── Keyboard (context-menu launch, accessibility) ──────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'menu') {
        if (e.key === 'Escape' && phaseRef.current !== 'running') hide()
        return
      }
      const rings = { fav: model.favorites.length, main: model.main.length, sub: openGroup !== null ? (model.main[openGroup]?.children?.length ?? 0) : 0 }
      const cur = hover ?? { ring: 'main' as const, index: 0 }
      const move = (t: Target) => {
        e.preventDefault()
        setHover(t)
        if (t.ring === 'main') setOpenGroup(model.main[t.index]?.children ? t.index : null)
        if (t.ring === 'fav') setOpenGroup(null)
      }
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft': {
          const n = rings[cur.ring] || 1
          const d = e.key === 'ArrowRight' ? 1 : -1
          return move({ ring: cur.ring, index: (cur.index + d + n) % n })
        }
        case 'ArrowUp':
          if (cur.ring === 'fav' && rings.main) return move({ ring: 'main', index: 0 })
          if (cur.ring === 'main' && model.main[cur.index]?.children) {
            e.preventDefault()
            setOpenGroup(cur.index)
            return setHover({ ring: 'sub', index: 0 })
          }
          return
        case 'ArrowDown':
          if (cur.ring === 'sub' && openGroup !== null) return move({ ring: 'main', index: openGroup })
          if (cur.ring === 'main' && rings.fav) return move({ ring: 'fav', index: 0 })
          return
        case 'Enter':
        case ' ':
          e.preventDefault()
          return activate(cur)
        case 'Escape':
          return hide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [model, hover, openGroup, activate, hide])

  // ── Render ────────────────────────────────────────────────────────────
  const hovered = nodeAt(model, hover, openGroup)
  const count = detected.count
  const kindLabel = detected.kind === 'mixed' || detected.kind === 'unknown' ? 'File' : KIND_LABEL[detected.kind]
  const centerTitle = model.blocked ? 'Unavailable' : hovered ? hovered.label : count > 1 ? `${count} files` : kindLabel
  const centerSub = model.blocked ?? (hovered ? hovered.hint.split(' · ')[0]! : mode === 'keyboard' ? '← → ↑ ↓ Enter' : 'Release on an action')

  const all = batchJobs.current.map((id) => jobs[id]).filter(Boolean) as JobUpdate[]
  const known = all.filter((j) => j.percent !== null)
  const percent = all.length && known.length === all.length ? known.reduce((s, j) => s + (j.percent ?? 0), 0) / all.length : null

  const cancel = () => batchJobs.current.forEach((id) => void api.cancelJob(id))
  const showMenu = phase === 'menu'
  const showProgress = phase === 'running' || phase === 'done' || phase === 'error'

  return (
    <div
      className={`overlay phase-${phase}`}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={(e) => mode === 'keyboard' && phase === 'menu' && updateHover(e.clientX, e.clientY)}
      onClick={(e) => {
        if (mode !== 'keyboard' || phase !== 'menu') return
        const t = updateHover(e.clientX, e.clientY)
        if (t) activate(t)
        else if (Math.hypot(e.clientX - center.cx, e.clientY - center.cy) > model.layout.core) hide()
      }}
    >
      <AnimatePresence>
        {showMenu && (
          <RadialMenu
            key="menu"
            model={model}
            cx={center.cx}
            cy={center.cy}
            hover={hover}
            openGroup={openGroup}
            centerTitle={centerTitle}
            centerSub={centerSub}
            batch={count > 1 || ctrl}
          />
        )}
      </AnimatePresence>
      {showProgress && (
        <ProgressCore phase={phase as 'running' | 'done' | 'error'} percent={percent} label={jobLabel} onCancel={cancel} />
      )}
    </div>
  )
}
