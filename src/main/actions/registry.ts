import { ACTIONS } from '@shared/actions'
import type { ActionImpl } from './types'
import { imageActions } from './image'
import { videoActions } from './video'
import { audioActions } from './audio'
import { pdfActions } from './pdf'
import { documentActions } from './document'

const IMPLS = new Map<string, ActionImpl>()
for (const impl of [...imageActions, ...videoActions, ...audioActions, ...pdfActions, ...documentActions]) {
  if (IMPLS.has(impl.id)) throw new Error(`Duplicate action implementation: ${impl.id}`)
  IMPLS.set(impl.id, impl)
}

export function getActionImpl(id: string): ActionImpl | undefined {
  return IMPLS.get(id)
}

/** Catalog ↔ implementation consistency check, run once at startup. */
export function verifyRegistry(): string[] {
  const problems: string[] = []
  for (const d of ACTIONS) if (!IMPLS.has(d.id)) problems.push(`No implementation for "${d.id}"`)
  for (const id of IMPLS.keys()) if (!ACTIONS.some((d) => d.id === id)) problems.push(`No descriptor for "${id}"`)
  return problems
}
