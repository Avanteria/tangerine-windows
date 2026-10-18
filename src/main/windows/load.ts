import type { BrowserWindow } from 'electron'
import { rendererUrl } from '../services/paths'

export function loadRoute(win: BrowserWindow, route: 'overlay' | 'settings' | 'toast') {
  const r = rendererUrl(route)
  if (r.url) void win.loadURL(r.url)
  else void win.loadFile(r.file!, { hash: r.hash })
}
