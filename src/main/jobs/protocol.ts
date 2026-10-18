import type { QualityPreset, ToolName } from '@shared/types'

export interface WorkerJob {
  jobId: string
  actionId: string
  inputs: string[]
  /** Final destination (file, or folder for outputIsDir actions). Already de-duplicated by main. */
  output: string
  quality: QualityPreset
  /** Absolute executable paths resolved by the main process. */
  tools: Partial<Record<ToolName, string>>
}

export type ToWorker = { type: 'run'; job: WorkerJob } | { type: 'cancel'; jobId: string }

export type FromWorker =
  | { type: 'progress'; jobId: string; percent: number | null }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'done'; jobId: string; output: string }
  | { type: 'error'; jobId: string; error: string; detail?: string }
  | { type: 'cancelled'; jobId: string }
