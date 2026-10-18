import type {
  JobUpdate, OverlayShowPayload, RunRequest, RunResult, Settings, ToastPayload, ToolName, ToolStatus
} from './types'

/** The surface exposed on window.tangerine by the preload script. */
export interface TangerineApi {
  getPathForFile(file: File): string
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  toolsStatus(): Promise<ToolStatus[]>
  runAction(req: RunRequest): Promise<RunResult>
  cancelJob(jobId: string): Promise<void>
  pickFolder(): Promise<string | null>
  pickFile(tool: ToolName): Promise<string | null>
  hideOverlay(): void
  compactOverlay(): void
  openLogs(): void
  showItem(path: string): void
  openUrl(url: string): void
  openSettings(): void
  closeToast(): void
  onOverlayShow(cb: (p: OverlayShowPayload) => void): () => void
  onDragEnded(cb: () => void): () => void
  onJobUpdate(cb: (u: JobUpdate) => void): () => void
  onSettingsChanged(cb: (s: Settings) => void): () => void
  onThemeChanged(cb: (dark: boolean) => void): () => void
  onToast(cb: (t: ToastPayload) => void): () => void
}
