/**
 * Explorer right-click fallback ("Convert with Tangerine").
 * Per-user registration under HKCU — no admin rights needed. On Windows 11 the
 * entry lives under "Show more options" (the modern menu requires a packaged
 * MSIX + IExplorerCommand handler, listed on the roadmap in the README).
 */
import { execFile } from 'node:child_process'
import { app } from 'electron'
import { ALL_KINDS, KIND_EXTENSIONS } from '@shared/fileKinds'
import { logger } from '../services/logger'

const VERB = 'Tangerine'

function reg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) =>
    execFile('reg.exe', args, { windowsHide: true }, (err) => (err ? reject(err) : resolve()))
  )
}

/** Command line used by Explorer. In dev, electron.exe needs the app folder as first argument. */
function command(): string {
  const exe = `"${process.execPath}"`
  const appArg = app.isPackaged ? '' : ` "${app.getAppPath()}"`
  return `${exe}${appArg} --open "%1"`
}

/** Registered per supported extension so the entry only shows for files Tangerine understands. */
const keysFor = () =>
  ALL_KINDS.flatMap((k) => KIND_EXTENSIONS[k]).map(
    (ext) => `HKCU\\Software\\Classes\\SystemFileAssociations\\.${ext}\\shell\\${VERB}`
  )

export async function registerContextMenu() {
  const icon = `"${process.execPath}",0`
  try {
    for (const key of keysFor()) {
      await reg(['add', key, '/ve', '/d', 'Convert with Tangerine', '/f'])
      await reg(['add', key, '/v', 'Icon', '/d', icon, '/f'])
      // "Player" = one invocation per selected file; second-instance events are batched in main.
      await reg(['add', key, '/v', 'MultiSelectModel', '/d', 'Player', '/f'])
      await reg(['add', `${key}\\command`, '/ve', '/d', command(), '/f'])
    }
    logger.info('Context menu registered')
  } catch (err) {
    logger.error(`Context menu registration failed: ${(err as Error).message}`)
  }
}

export async function unregisterContextMenu() {
  for (const key of keysFor()) await reg(['delete', key, '/f']).catch(() => undefined)
  logger.info('Context menu removed')
}

/** Extract file paths following --open from a command line. */
export function parseOpenArgs(argv: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--open' && argv[i + 1]) out.push(argv[++i]!)
  return out
}
