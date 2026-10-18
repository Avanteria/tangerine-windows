import fs from 'node:fs'
import path from 'node:path'
import { app, dialog } from 'electron'
import type { Settings } from '@shared/types'

export type OutputTarget = { dir: string } | { askPerFile: true } | { cancelled: true }

/** Picks the output folder according to the user's preference. */
export async function outputTargetFor(firstInput: string, s: Settings, jobCount: number): Promise<OutputTarget> {
  switch (s.outputMode) {
    case 'source':
      return { dir: path.dirname(firstInput) }
    case 'custom':
      if (s.customOutputDir && fs.existsSync(s.customOutputDir)) return { dir: s.customOutputDir }
      return { dir: app.getPath('desktop') }
    case 'ask': {
      // Native Windows dialogs: a Save dialog for a single result, a folder picker for batches.
      if (jobCount === 1) return { askPerFile: true }
      const r = await dialog.showOpenDialog({ title: 'Save converted files to…', properties: ['openDirectory', 'createDirectory'] })
      return r.canceled || !r.filePaths[0] ? { cancelled: true } : { dir: r.filePaths[0] }
    }
    default:
      return { dir: app.getPath('desktop') }
  }
}

export async function saveAsFor(suggested: string): Promise<string | null> {
  const ext = path.extname(suggested).slice(1)
  const r = await dialog.showSaveDialog({
    title: 'Save converted file',
    defaultPath: suggested,
    filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : []
  })
  return r.canceled || !r.filePath ? null : r.filePath
}

/** "photo.heic" → "photo_converted.jpg", then "photo_converted (2).jpg" if taken. */
export function uniqueOutputPath(dir: string, input: string, suffix: string, ext: string, reserved: Set<string>): string {
  const stem = path.parse(input).name
  const dotExt = ext ? `.${ext}` : ''
  for (let n = 1; ; n++) {
    const name = `${stem}${suffix}${n > 1 ? ` (${n})` : ''}${dotExt}`
    const candidate = path.join(dir, name)
    if (!reserved.has(candidate.toLowerCase()) && !fs.existsSync(candidate)) {
      reserved.add(candidate.toLowerCase())
      return candidate
    }
  }
}
