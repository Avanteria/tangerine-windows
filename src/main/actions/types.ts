import type { QualityPreset, ToolName } from '@shared/types'

/** One external process invocation (or an internal file move). */
export interface Step {
  tool: ToolName | '@move'
  args: string[]
  /** Parse FFmpeg `-progress` output for a real percentage. */
  progress?: 'ffmpeg'
  /** Extra environment for this step. */
  env?: Record<string, string>
}

export interface BuildContext {
  /** Staged inputs: short-path safe (long paths are hard-linked into tmpDir). */
  inputs: string[]
  /** Lower-case extension of the first input, no dot. */
  inputExt: string
  /** Staged output path (a file, or a directory when outputIsDir). Moved to the final location afterwards. */
  output: string
  tmpDir: string
  quality: QualityPreset
  /** Media duration in seconds (only when needsDuration). */
  duration?: number
}

export interface ActionImpl {
  id: string
  /** Output extension; may depend on the input extension. */
  outputExt: (inputExt: string) => string
  /** The action writes a folder (e.g. one PNG per PDF page). */
  outputIsDir?: boolean
  /** Probe duration with ffprobe before building (for progress / frame seeking). */
  needsDuration?: boolean
  /** Suffix override, e.g. '_merged'. */
  suffix?: string
  build(ctx: BuildContext): Step[]
}

export const pick = <T>(q: QualityPreset, high: T, balanced: T, small: T): T =>
  q === 'high' ? high : q === 'small' ? small : balanced
