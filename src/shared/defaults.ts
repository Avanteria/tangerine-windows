import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  launchOnStartup: true,
  checkForUpdates: true,
  shiftDragEnabled: true,
  theme: 'system',
  outputMode: 'desktop',
  customOutputDir: '',
  suffix: '_converted',
  quality: 'balanced',
  enabledKinds: { image: true, video: true, audio: true, pdf: true, document: true },
  favorites: {
    image: ['image.to-png', 'image.to-jpg', 'image.to-webp', 'image.compress'],
    video: ['video.to-mp4', 'video.compress', 'video.extract-audio', 'video.to-gif'],
    audio: ['audio.to-mp3', 'audio.to-wav', 'audio.to-m4a', 'audio.to-flac'],
    pdf: ['pdf.compress', 'pdf.to-png', 'pdf.merge'],
    document: ['doc.to-pdf', 'doc.to-md']
  },
  contextMenu: true,
  toolPaths: {}
}

export const MAX_FAVORITES = 4
