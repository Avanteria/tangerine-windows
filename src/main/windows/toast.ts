/** Small, non-focus-stealing notification card (bottom-right), used for errors with "Open Logs". */
import { BrowserWindow, screen } from 'electron'
import { randomUUID } from 'node:crypto'
import { IPC } from '@shared/ipc'
import type { ToastPayload } from '@shared/types'
import { preloadPath } from '../services/paths'
import { isDark } from '../services/theme'
import { loadRoute } from './load'

const W = 384
const H = 104
let win: BrowserWindow | null = null
let ready: Promise<void> | null = null
let timer: NodeJS.Timeout | null = null

function ensure(): Promise<void> {
  if (win && !win.isDestroyed() && ready) return ready
  win = new BrowserWindow({
    width: W,
    height: H,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: preloadPath(), sandbox: true, contextIsolation: true }
  })
  win.setAlwaysOnTop(true, 'pop-up-menu')
  win.on('closed', () => {
    win = null
    ready = null
  })
  ready = new Promise((resolve) => win!.webContents.once('did-finish-load', () => resolve()))
  loadRoute(win, 'toast')
  return ready
}

export async function showToast(t: Omit<ToastPayload, 'id' | 'dark'>) {
  await ensure()
  if (!win) return
  const wa = screen.getPrimaryDisplay().workArea
  win.setBounds({ x: wa.x + wa.width - W - 16, y: wa.y + wa.height - H - 16, width: W, height: H })
  win.webContents.send(IPC.toastShow, { ...t, id: randomUUID(), dark: isDark() } satisfies ToastPayload)
  win.showInactive()
  if (timer) clearTimeout(timer)
  timer = setTimeout(hideToast, t.level === 'error' ? 12_000 : 6_000)
}

export function hideToast() {
  win?.hide()
}
