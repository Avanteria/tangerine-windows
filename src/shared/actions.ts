/**
 * The action CATALOG: renderer-safe descriptors only (label, icon, which files it accepts).
 * The matching implementation (command-line builder) lives in src/main/actions/<kind>.ts
 * under the same id. To add a new conversion:
 *   1. add a descriptor here,
 *   2. add an ActionImpl with the same id in src/main/actions,
 * and it automatically appears in the radial menu, the Favorites picker and the batch engine.
 */
import type { FileKind, ToolName } from './types'

export type IconName =
  | 'FileImage' | 'FileType' | 'Image' | 'ImageDown' | 'Scaling' | 'RotateCw' | 'Shrink'
  | 'Film' | 'Clapperboard' | 'Music' | 'AudioLines' | 'Camera' | 'Sparkles' | 'FileText'
  | 'FileDown' | 'Files' | 'Layers' | 'FileAudio' | 'FileVideo' | 'SlidersHorizontal'
  | 'MoreHorizontal' | 'Combine' | 'Hash'

export interface ActionDescriptor {
  id: string
  /** Short label shown on the ring segment. */
  label: string
  /** Sentence shown in the menu centre on hover. */
  hint: string
  icon: IconName
  kind: FileKind
  /** 'convert' actions sit on the main ring; 'edit' actions live in the Edit sub-ring. */
  group: 'convert' | 'edit'
  /** Restrict to these input extensions (lower-case, no dot). Omit = every extension of the kind. */
  accepts?: string[]
  /** Hide for these input extensions (e.g. "to PNG" when the file already is PNG). */
  excludes?: string[]
  /** 'each' = one job per file (default). 'merge' = one job consuming all files. */
  batch?: 'each' | 'merge'
  minFiles?: number
  /** External tools this action needs; used for availability checks and friendly errors. */
  tools: ToolName[]
}

export const ACTIONS: ActionDescriptor[] = [
  // ── Images (6) ───────────────────────────────────────────────────────────
  { id: 'image.to-png', label: 'PNG', hint: 'Convert to PNG', icon: 'FileImage', kind: 'image', group: 'convert', excludes: ['png'], tools: ['magick'] },
  { id: 'image.to-jpg', label: 'JPG', hint: 'Convert to JPG', icon: 'Image', kind: 'image', group: 'convert', excludes: ['jpg', 'jpeg'], tools: ['magick'] },
  { id: 'image.to-webp', label: 'WEBP', hint: 'Convert to WebP', icon: 'ImageDown', kind: 'image', group: 'convert', excludes: ['webp'], tools: ['magick'] },
  { id: 'image.compress', label: 'Compress', hint: 'Compress image (quality preset)', icon: 'Shrink', kind: 'image', group: 'edit', tools: ['magick'] },
  { id: 'image.resize-50', label: 'Resize 50%', hint: 'Resize to 50%', icon: 'Scaling', kind: 'image', group: 'edit', tools: ['magick'] },
  { id: 'image.rotate-90', label: 'Rotate', hint: 'Rotate 90° clockwise', icon: 'RotateCw', kind: 'image', group: 'edit', tools: ['magick'] },

  // ── Video (5) ────────────────────────────────────────────────────────────
  { id: 'video.to-mp4', label: 'MP4', hint: 'Convert to MP4 (H.264)', icon: 'Film', kind: 'video', group: 'convert', tools: ['ffmpeg', 'ffprobe'] },
  { id: 'video.to-gif', label: 'GIF', hint: 'Convert to animated GIF', icon: 'Sparkles', kind: 'video', group: 'convert', tools: ['ffmpeg', 'ffprobe'] },
  { id: 'video.compress', label: 'Compress', hint: 'Compress video (≤1080p, H.264)', icon: 'Shrink', kind: 'video', group: 'edit', tools: ['ffmpeg', 'ffprobe'] },
  { id: 'video.extract-audio', label: 'Audio', hint: 'Extract audio as MP3', icon: 'AudioLines', kind: 'video', group: 'edit', tools: ['ffmpeg', 'ffprobe'] },
  { id: 'video.extract-frame', label: 'Frame', hint: 'Extract a frame as PNG', icon: 'Camera', kind: 'video', group: 'edit', tools: ['ffmpeg', 'ffprobe'] },

  // ── Audio (4) ────────────────────────────────────────────────────────────
  { id: 'audio.to-mp3', label: 'MP3', hint: 'Convert to MP3', icon: 'Music', kind: 'audio', group: 'convert', excludes: ['mp3'], tools: ['ffmpeg', 'ffprobe'] },
  { id: 'audio.to-wav', label: 'WAV', hint: 'Convert to WAV (16-bit PCM)', icon: 'AudioLines', kind: 'audio', group: 'convert', excludes: ['wav'], tools: ['ffmpeg', 'ffprobe'] },
  { id: 'audio.to-m4a', label: 'M4A', hint: 'Convert to M4A (AAC)', icon: 'FileAudio', kind: 'audio', group: 'convert', excludes: ['m4a'], tools: ['ffmpeg', 'ffprobe'] },
  { id: 'audio.to-flac', label: 'FLAC', hint: 'Convert to FLAC (lossless)', icon: 'Layers', kind: 'audio', group: 'convert', excludes: ['flac'], tools: ['ffmpeg', 'ffprobe'] },

  // ── PDF (3) ──────────────────────────────────────────────────────────────
  { id: 'pdf.compress', label: 'Compress', hint: 'Compress PDF', icon: 'Shrink', kind: 'pdf', group: 'edit', tools: ['gs'] },
  { id: 'pdf.to-png', label: 'PNG pages', hint: 'Export every page as PNG', icon: 'FileImage', kind: 'pdf', group: 'convert', tools: ['gs'] },
  { id: 'pdf.merge', label: 'Merge', hint: 'Merge selected PDFs into one', icon: 'Combine', kind: 'pdf', group: 'edit', batch: 'merge', minFiles: 2, tools: ['qpdf'] },

  // ── Documents (2) ────────────────────────────────────────────────────────
  { id: 'doc.to-pdf', label: 'PDF', hint: 'Convert to PDF', icon: 'FileDown', kind: 'document', group: 'convert', tools: ['soffice', 'pandoc'] },
  { id: 'doc.to-md', label: 'Markdown', hint: 'Convert to Markdown', icon: 'Hash', kind: 'document', group: 'convert', accepts: ['docx', 'rtf', 'txt', 'odt'], tools: ['pandoc'] }
]

export const ACTIONS_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

export function actionFits(a: ActionDescriptor, ext: string | null, fileCount: number): boolean {
  if ((a.minFiles ?? 1) > fileCount) return false
  if (ext) {
    if (a.accepts && !a.accepts.includes(ext)) return false
    if (a.excludes && a.excludes.includes(ext)) return false
  }
  return true
}
