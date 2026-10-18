import {
  AudioLines, Camera, Clapperboard, Combine, FileAudio, FileDown, FileImage, FileText, FileType, FileVideo,
  Files, Film, Hash, Image, ImageDown, Layers, MoreHorizontal, Music, RotateCw, Scaling, Shrink,
  SlidersHorizontal, Sparkles, type LucideIcon
} from 'lucide-react'
import type { IconName } from '@shared/actions'
import type { DetectedKind } from '@shared/types'

export const ICONS: Record<IconName, LucideIcon> = {
  AudioLines, Camera, Clapperboard, Combine, FileAudio, FileDown, FileImage, FileText, FileType, FileVideo,
  Files, Film, Hash, Image, ImageDown, Layers, MoreHorizontal, Music, RotateCw, Scaling, Shrink,
  SlidersHorizontal, Sparkles
}

export const KIND_ICON: Record<DetectedKind, IconName> = {
  image: 'FileImage',
  video: 'FileVideo',
  audio: 'FileAudio',
  pdf: 'FileText',
  document: 'FileType',
  mixed: 'Files',
  unknown: 'Files'
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name]
  return <C size={size} strokeWidth={1.75} className={className} aria-hidden />
}
