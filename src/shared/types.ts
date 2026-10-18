/** Shared, renderer-safe types. No Node or Electron imports allowed in src/shared. */

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'document'
export type DetectedKind = FileKind | 'mixed' | 'unknown'

export type QualityPreset = 'high' | 'balanced' | 'small'
export type OutputMode = 'desktop' | 'source' | 'custom' | 'ask'
export type ThemePref = 'system' | 'dark' | 'light'

export type ToolName = 'ffmpeg' | 'ffprobe' | 'magick' | 'gs' | 'qpdf' | 'pandoc' | 'soffice'

export interface Settings {
  launchOnStartup: boolean
  checkForUpdates: boolean
  shiftDragEnabled: boolean
  theme: ThemePref
  outputMode: OutputMode
  customOutputDir: string
  suffix: string
  quality: QualityPreset
  enabledKinds: Record<FileKind, boolean>
  /** Up to 4 pinned action ids per file kind, shown in the inner ring. */
  favorites: Record<FileKind, string[]>
  contextMenu: boolean
  /** Optional user overrides for tools that are not bundled (Ghostscript, LibreOffice). */
  toolPaths: Partial<Record<ToolName, string>>
}

export interface ToolStatus {
  name: ToolName
  label: string
  path: string | null
  source: 'bundled' | 'override' | 'system' | 'missing'
  requiredFor: string
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

export interface JobUpdate {
  batchId: string
  jobId: string
  actionId: string
  file: string
  status: JobStatus
  /** 0..100, or null when the tool cannot report progress. */
  percent: number | null
  output?: string
  error?: string
}

export interface RunRequest {
  actionId: string
  files: string[]
}

export type RunResult =
  | { ok: true; batchId: string; jobIds: string[] }
  | { ok: false; error: string }

export interface OverlayShowPayload {
  /** Where the menu centre sits, in window-local CSS pixels. */
  cx: number
  cy: number
  mode: 'drag' | 'keyboard'
  /** CTRL was held when the drag started (batch intent). */
  ctrl: boolean
  /** Known when launched from the Explorer context menu. */
  files?: string[]
  settings: Settings
  dark: boolean
}

export interface ToastPayload {
  id: string
  level: 'info' | 'success' | 'error'
  title: string
  message?: string
  /** Primary action button. */
  action?: { label: string; kind: 'open-logs' | 'show-item' | 'open-url'; target?: string }
  dark: boolean
}
