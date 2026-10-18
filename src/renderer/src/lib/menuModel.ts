import { ACTIONS, ACTIONS_BY_ID, actionFits, type ActionDescriptor, type IconName } from '@shared/actions'
import { ALL_KINDS, KIND_LABEL } from '@shared/fileKinds'
import { MAX_FAVORITES } from '@shared/defaults'
import type { DetectedKind, FileKind, Settings } from '@shared/types'
import { KIND_ICON } from './icons'
import { angleOf, layoutFor, ringSlots, slotAt, subSlotAt, type RingLayout } from './geometry'

export interface MenuNode {
  key: string
  label: string
  hint: string
  icon: IconName
  actionId?: string
  children?: MenuNode[]
  disabled?: boolean
}

export interface MenuModel {
  kind: DetectedKind
  favorites: MenuNode[]
  main: MenuNode[]
  layout: RingLayout
  /** Non-null when nothing can be done (e.g. kind disabled). */
  blocked: string | null
}

export type Ring = 'fav' | 'main' | 'sub'
export interface Target {
  ring: Ring
  index: number
}

const MAX_MAIN = 12
export const FAV_OFFSET = (n: number) => 180 / Math.max(1, n)

const node = (a: ActionDescriptor, count: number): MenuNode => ({
  key: a.id,
  label: a.label,
  hint: count > 1 && a.batch !== 'merge' ? `${a.hint} · ${count} files` : a.hint,
  icon: a.icon,
  actionId: a.id
})

function ringFor(actions: ActionDescriptor[], count: number): MenuNode[] {
  const converts = actions.filter((a) => a.group === 'convert').map((a) => node(a, count))
  const edits = actions.filter((a) => a.group === 'edit').map((a) => node(a, count))
  const room = MAX_MAIN - (edits.length ? 1 : 0)
  let main = converts
  if (converts.length > room) {
    main = converts.slice(0, room - 1)
    main.push({ key: 'more', label: 'More', hint: 'More formats', icon: 'MoreHorizontal', children: converts.slice(room - 1) })
  }
  if (edits.length) main.push({ key: 'edit', label: 'Edit', hint: 'Edit options', icon: 'SlidersHorizontal', children: edits })
  return main
}

export function buildMenu(kind: DetectedKind, ext: string | null, count: number, s: Settings): MenuModel {
  if (kind === 'mixed' || kind === 'unknown') {
    // Type not known yet (MIME missing) or mixed selection: offer every kind as a group.
    const main = ALL_KINDS.filter((k) => s.enabledKinds[k]).map<MenuNode>((k) => ({
      key: `kind:${k}`,
      label: KIND_LABEL[k],
      hint: `${KIND_LABEL[k]} actions`,
      icon: KIND_ICON[k],
      children: ACTIONS.filter((a) => a.kind === k && actionFits(a, null, count)).map((a) => node(a, count))
    }))
    return { kind, favorites: [], main, layout: layoutFor(false), blocked: main.length ? null : 'All file types are disabled' }
  }
  if (!s.enabledKinds[kind]) {
    return { kind, favorites: [], main: [], layout: layoutFor(false), blocked: `${KIND_LABEL[kind]} files are disabled in Settings` }
  }
  const fits = ACTIONS.filter((a) => a.kind === kind && actionFits(a, ext, count))
  const favorites = (s.favorites[kind as FileKind] ?? [])
    .map((id) => ACTIONS_BY_ID.get(id))
    .filter((a): a is ActionDescriptor => !!a && fits.includes(a))
    .slice(0, MAX_FAVORITES)
    .map((a) => ({ ...node(a, count), key: `fav:${a.id}` }))
  return { kind, favorites, main: ringFor(fits, count), layout: layoutFor(favorites.length > 0), blocked: null }
}

export function hitTest(m: MenuModel, dx: number, dy: number, openGroup: number | null): Target | null {
  const r = Math.hypot(dx, dy)
  const a = angleOf(dx, dy)
  const { layout } = m
  if (layout.fav && r >= layout.fav[0] - 3 && r < layout.fav[1] + 3 && m.favorites.length) {
    return { ring: 'fav', index: slotAt(a, m.favorites.length, FAV_OFFSET(m.favorites.length)) }
  }
  if (r >= layout.main[0] - 3 && r < layout.main[1] + 3 && m.main.length) {
    return { ring: 'main', index: slotAt(a, m.main.length) }
  }
  if (openGroup !== null && r >= layout.sub[0] - 3 && r < layout.sub[1] + 24) {
    const children = m.main[openGroup]?.children ?? []
    const parentMid = ringSlots(m.main.length)[openGroup]!.mid
    const idx = subSlotAt(a, parentMid, children.length)
    if (idx !== null) return { ring: 'sub', index: idx }
  }
  return null
}

export function nodeAt(m: MenuModel, t: Target | null, openGroup: number | null): MenuNode | null {
  if (!t) return null
  if (t.ring === 'fav') return m.favorites[t.index] ?? null
  if (t.ring === 'main') return m.main[t.index] ?? null
  return openGroup !== null ? (m.main[openGroup]?.children?.[t.index] ?? null) : null
}
