import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const MAX_BYTES = 2 * 1024 * 1024
let file: string | null = null

function target(): string {
  if (!file) {
    const dir = app.getPath('logs')
    fs.mkdirSync(dir, { recursive: true })
    file = path.join(dir, 'tangerine.log')
  }
  return file
}

function write(level: string, message: string) {
  const line = `${new Date().toISOString()} [${level}] ${message}\n`
  try {
    const f = target()
    // Simple single-file rotation: keep one previous log.
    if (fs.existsSync(f) && fs.statSync(f).size > MAX_BYTES) fs.renameSync(f, `${f}.1`)
    fs.appendFileSync(f, line)
  } catch {
    /* logging must never crash the app */
  }
  if (!app.isPackaged) process.stdout.write(line)
}

export const logger = {
  info: (m: string) => write('INFO', m),
  warn: (m: string) => write('WARN', m),
  error: (m: string) => write('ERROR', m),
  get filePath() {
    return target()
  },
  get dir() {
    return path.dirname(target())
  }
}
