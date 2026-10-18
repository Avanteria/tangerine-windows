import type { DetectedKind, FileKind } from './types'

export const KIND_EXTENSIONS: Record<FileKind, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tif', 'tiff', 'gif', 'bmp', 'svg'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
  audio: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'opus'],
  pdf: ['pdf'],
  document: ['docx', 'doc', 'txt', 'rtf', 'md', 'markdown', 'odt']
}

export const KIND_LABEL: Record<FileKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  pdf: 'PDF',
  document: 'Document'
}

export const ALL_KINDS: FileKind[] = ['image', 'video', 'audio', 'pdf', 'document']

const EXT_TO_KIND = new Map<string, FileKind>()
for (const kind of ALL_KINDS) for (const ext of KIND_EXTENSIONS[kind]) EXT_TO_KIND.set(ext, kind)

export function extOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export function kindFromExt(ext: string): FileKind | null {
  return EXT_TO_KIND.get(ext.toLowerCase()) ?? null
}

export function kindFromPath(p: string): FileKind | null {
  return kindFromExt(extOf(p))
}

/** Best-effort MIME → extension, used while a drag is in flight (paths are not exposed until drop). */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
  'image/tiff': 'tiff', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/x-msvideo': 'avi', 'video/avi': 'avi',
  'video/x-matroska': 'mkv', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac',
  'audio/flac': 'flac', 'audio/x-flac': 'flac', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc', 'text/plain': 'txt', 'application/rtf': 'rtf', 'text/rtf': 'rtf',
  'text/markdown': 'md', 'text/x-markdown': 'md'
}

export function extFromMime(mime: string): string | null {
  return MIME_TO_EXT[mime.toLowerCase()] ?? null
}

export function kindFromMime(mime: string): FileKind | null {
  const ext = extFromMime(mime)
  if (ext) return kindFromExt(ext)
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

/** Collapse a set of per-file kinds into one menu kind. */
export function combineKinds(kinds: (FileKind | null)[]): DetectedKind {
  if (kinds.length === 0) return 'unknown'
  if (kinds.some((k) => k === null)) return 'unknown'
  const first = kinds[0]!
  return kinds.every((k) => k === first) ? first : 'mixed'
}
