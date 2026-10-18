/** Polar helpers for the radial menu. Angles in degrees, 0° = 12 o'clock, clockwise. */

export interface RingLayout {
  core: number
  fav: [number, number] | null
  main: [number, number]
  sub: [number, number]
}

export function layoutFor(hasFavorites: boolean): RingLayout {
  return hasFavorites
    ? { core: 44, fav: [50, 96], main: [102, 170], sub: [176, 236] }
    : { core: 44, fav: null, main: [50, 128], sub: [134, 196] }
}

export const norm = (a: number) => ((a % 360) + 360) % 360

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)]
}

export function angleOf(dx: number, dy: number): number {
  return norm((Math.atan2(dx, -dy) * 180) / Math.PI)
}

/** SVG path for an annular sector between radii r0..r1 and angles a0..a1. */
export function sectorPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (a1 - a0 >= 359.9) {
    // Full ring: two half-sectors.
    return sectorPath(cx, cy, r0, r1, 0, 180) + ' ' + sectorPath(cx, cy, r0, r1, 180, 360)
  }
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(cx, cy, r1, a0)
  const [x1, y1] = polar(cx, cy, r1, a1)
  const [x2, y2] = polar(cx, cy, r0, a1)
  const [x3, y3] = polar(cx, cy, r0, a0)
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`
}

/** Evenly divided ring: slot i is centred at offset + i*step. */
export function ringSlots(n: number, offset = 0) {
  const step = 360 / Math.max(1, n)
  return Array.from({ length: n }, (_, i) => {
    const mid = offset + i * step
    return { mid, a0: mid - step / 2, a1: mid + step / 2 }
  })
}

export function slotAt(angle: number, n: number, offset = 0): number {
  const step = 360 / Math.max(1, n)
  return Math.round(norm(angle - offset) / step) % n
}

/** Sub-ring arc fanned out around its parent segment. */
export function subSlots(parentMid: number, m: number) {
  const span = Math.min(34, 300 / Math.max(1, m))
  const start = parentMid - (span * m) / 2
  return Array.from({ length: m }, (_, i) => ({ a0: start + i * span, a1: start + (i + 1) * span, mid: start + (i + 0.5) * span }))
}

export function subSlotAt(angle: number, parentMid: number, m: number): number | null {
  const span = Math.min(34, 300 / Math.max(1, m))
  const start = parentMid - (span * m) / 2
  const rel = norm(angle - start)
  const idx = Math.floor(rel / span)
  return idx >= 0 && idx < m ? idx : null
}
