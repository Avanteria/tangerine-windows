import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { app } from 'electron'
import { DEFAULT_SETTINGS, MAX_FAVORITES } from '@shared/defaults'
import { ACTIONS_BY_ID } from '@shared/actions'
import type { FileKind, Settings } from '@shared/types'
import { logger } from './logger'

/** Tiny JSON settings store (no dependency, atomic writes). */
class SettingsStore extends EventEmitter {
  private data: Settings = structuredClone(DEFAULT_SETTINGS)
  private file = ''

  load() {
    this.file = path.join(app.getPath('userData'), 'settings.json')
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<Settings>
      this.data = sanitize({ ...structuredClone(DEFAULT_SETTINGS), ...raw })
    } catch {
      this.data = structuredClone(DEFAULT_SETTINGS)
    }
    return this.data
  }

  get(): Settings {
    return this.data
  }

  set(patch: Partial<Settings>): Settings {
    const prev = this.data
    this.data = sanitize({ ...prev, ...patch })
    try {
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2))
      fs.renameSync(tmp, this.file)
    } catch (err) {
      logger.error(`Could not save settings: ${(err as Error).message}`)
    }
    this.emit('change', this.data, prev)
    return this.data
  }
}

function sanitize(s: Settings): Settings {
  const favorites = { ...DEFAULT_SETTINGS.favorites, ...s.favorites }
  for (const kind of Object.keys(favorites) as FileKind[]) {
    favorites[kind] = [...new Set(favorites[kind] ?? [])]
      .filter((id) => ACTIONS_BY_ID.get(id)?.kind === kind)
      .slice(0, MAX_FAVORITES)
  }
  return {
    ...s,
    enabledKinds: { ...DEFAULT_SETTINGS.enabledKinds, ...s.enabledKinds },
    favorites,
    suffix: (s.suffix ?? '').replace(/[<>:"/\\|?*]/g, '').slice(0, 40),
    toolPaths: { ...s.toolPaths }
  }
}

export const settings = new SettingsStore()
