import { AnimatePresence, motion } from 'framer-motion'
import { Icon, KIND_ICON } from '../lib/icons'
import { polar, ringSlots, sectorPath, subSlots } from '../lib/geometry'
import { FAV_OFFSET, type MenuModel, type MenuNode, type Target } from '../lib/menuModel'

interface Props {
  model: MenuModel
  cx: number
  cy: number
  hover: Target | null
  openGroup: number | null
  centerTitle: string
  centerSub: string
  batch: boolean
}

const GAP = 1.2 // degrees between segments

function Segment(props: {
  cx: number; cy: number; r0: number; r1: number; a0: number; a1: number; mid: number
  node: MenuNode; active: boolean; open?: boolean; variant: 'fav' | 'main' | 'sub'
}) {
  const { cx, cy, r0, r1, a0, a1, mid, node, active, open, variant } = props
  const [lx, ly] = polar(cx, cy, (r0 + r1) / 2, mid)
  const compact = variant === 'fav'
  return (
    <g className={`seg seg--${variant}${active ? ' is-active' : ''}${open ? ' is-open' : ''}${node.disabled ? ' is-disabled' : ''}`}>
      <path d={sectorPath(cx, cy, r0, r1, a0 + GAP / 2, a1 - GAP / 2)} />
      <foreignObject x={lx - 34} y={ly - 22} width={68} height={44} pointerEvents="none">
        <div className="seg-label">
          <Icon name={node.icon} size={compact ? 16 : 18} />
          {!compact && <span>{node.label}</span>}
          {node.children && <span className="seg-caret" />}
        </div>
      </foreignObject>
    </g>
  )
}

export function RadialMenu({ model, cx, cy, hover, openGroup, centerTitle, centerSub, batch }: Props) {
  const { layout } = model
  const mainSlots = ringSlots(model.main.length)
  const favSlots = ringSlots(model.favorites.length, FAV_OFFSET(model.favorites.length))
  const group = openGroup !== null ? model.main[openGroup] : null
  const sub = group?.children ? subSlots(mainSlots[openGroup!]!.mid, group.children.length) : []
  const size = layout.sub[1] * 2 + 40

  return (
    <motion.div
      className="radial"
      style={{ left: cx - size / 2, top: cy - size / 2, width: size, height: size }}
      initial={{ opacity: 0, scale: 0.86 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.6 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="menu" aria-label="Tangerine actions">
        <defs>
          <radialGradient id="glass" cx="50%" cy="35%" r="75%">
            <stop offset="0%" stopColor="var(--glass-hi)" />
            <stop offset="100%" stopColor="var(--glass)" />
          </radialGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        {/* The svg is positioned so its own centre (size/2, size/2) sits on the cursor (cx, cy). */}
        <g filter="url(#shadow)">
          <g>
            <circle cx={size / 2} cy={size / 2} r={layout.core} className="core-disc" />
            {layout.fav &&
              model.favorites.map((n, i) => (
                <Segment key={n.key} cx={size / 2} cy={size / 2} r0={layout.fav![0]} r1={layout.fav![1]}
                  {...favSlots[i]!} node={n} variant="fav" active={hover?.ring === 'fav' && hover.index === i} />
              ))}
            {model.main.map((n, i) => (
              <Segment key={n.key} cx={size / 2} cy={size / 2} r0={layout.main[0]} r1={layout.main[1]}
                {...mainSlots[i]!} node={n} variant="main" open={openGroup === i}
                active={hover?.ring === 'main' && hover.index === i} />
            ))}
            <AnimatePresence>
              {group?.children && (
                <motion.g key={group.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.09 }}>
                  {group.children.map((n, i) => (
                    <Segment key={n.key} cx={size / 2} cy={size / 2} r0={layout.sub[0]} r1={layout.sub[1]}
                      {...sub[i]!} node={n} variant="sub" active={hover?.ring === 'sub' && hover.index === i} />
                  ))}
                </motion.g>
              )}
            </AnimatePresence>
          </g>
        </g>
      </svg>
      <div className="core-text" style={{ width: layout.core * 2 - 8 }}>
        <Icon name={KIND_ICON[model.kind]} size={16} className="core-icon" />
        <strong>{centerTitle}</strong>
        {centerSub && <small>{centerSub}</small>}
        {batch && <em className="badge">Batch</em>}
      </div>
    </motion.div>
  )
}
