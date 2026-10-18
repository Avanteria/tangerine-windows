/**
 * Locates every external binary. Resolution order:
 *   1. user override in Settings
 *   2. bundled copy in resources/bin (FFmpeg, ffprobe, ImageMagick, qpdf, Pandoc)
 *   3. well-known install folders (Ghostscript, LibreOffice are installed system-wide)
 *   4. PATH
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ToolName, ToolStatus } from '@shared/types'
import { binDir } from './paths'
import { settings } from './settings'

interface ToolSpec {
  label: string
  requiredFor: string
  bundled: string[]
  system: () => string[]
  exe: string
}

const PF = process.env['ProgramFiles'] ?? 'C:\\Program Files'
const PF86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'

function ghostscriptCandidates(): string[] {
  const out: string[] = []
  for (const root of [path.join(PF, 'gs'), path.join(PF86, 'gs')]) {
    try {
      const versions = fs.readdirSync(root).filter((d) => d.startsWith('gs')).sort().reverse()
      for (const v of versions) out.push(path.join(root, v, 'bin', 'gswin64c.exe'), path.join(root, v, 'bin', 'gswin32c.exe'))
    } catch {
      /* not installed */
    }
  }
  return out
}

const SPECS: Record<ToolName, ToolSpec> = {
  ffmpeg: { label: 'FFmpeg', requiredFor: 'Video & audio', bundled: ['ffmpeg.exe'], system: () => [], exe: 'ffmpeg.exe' },
  ffprobe: { label: 'FFprobe', requiredFor: 'Video & audio progress', bundled: ['ffprobe.exe'], system: () => [], exe: 'ffprobe.exe' },
  magick: { label: 'ImageMagick', requiredFor: 'Images', bundled: ['imagemagick/magick.exe'], system: () => [], exe: 'magick.exe' },
  qpdf: { label: 'qpdf', requiredFor: 'Merge PDFs', bundled: ['qpdf/bin/qpdf.exe'], system: () => [], exe: 'qpdf.exe' },
  pandoc: { label: 'Pandoc', requiredFor: 'Markdown documents', bundled: ['pandoc/pandoc.exe'], system: () => [], exe: 'pandoc.exe' },
  gs: { label: 'Ghostscript', requiredFor: 'PDF compress & export', bundled: ['gs/bin/gswin64c.exe'], system: ghostscriptCandidates, exe: 'gswin64c.exe' },
  soffice: {
    label: 'LibreOffice',
    requiredFor: 'Documents → PDF',
    bundled: [],
    system: () => [path.join(PF, 'LibreOffice', 'program', 'soffice.exe'), path.join(PF86, 'LibreOffice', 'program', 'soffice.exe')],
    exe: 'soffice.exe'
  }
}

const exists = (p: string) => {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function onPath(exe: string): string | null {
  for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir.replace(/"/g, ''), exe)
    if (exists(candidate)) return candidate
  }
  return null
}

const cache = new Map<ToolName, ToolStatus>()
settings.on('change', () => cache.clear())

export function resolveTool(name: ToolName): ToolStatus {
  const hit = cache.get(name)
  if (hit) return hit
  const spec = SPECS[name]
  let status: ToolStatus = { name, label: spec.label, requiredFor: spec.requiredFor, path: null, source: 'missing' }
  const override = settings.get().toolPaths[name]
  if (override && exists(override)) status = { ...status, path: override, source: 'override' }
  else {
    const bundled = spec.bundled.map((b) => path.join(binDir(), b)).find(exists)
    if (bundled) status = { ...status, path: bundled, source: 'bundled' }
    else {
      const sys = spec.system().find(exists) ?? onPath(spec.exe)
      if (sys) status = { ...status, path: sys, source: 'system' }
    }
  }
  cache.set(name, status)
  return status
}

export const allToolStatus = (): ToolStatus[] => (Object.keys(SPECS) as ToolName[]).map(resolveTool)
