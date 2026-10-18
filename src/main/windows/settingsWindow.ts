import { BrowserWindow } from 'electron'
import path from 'node:path'
import { preloadPath, iconsDir } from '../services/paths'
import { loadRoute } from './load'

let win: BrowserWindow | null = null

/** Created on demand and destroyed on close, keeping idle memory low. */
export function openSettings() {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }
  win = new BrowserWindow({
    width: 820,
    height: 680,
    minWidth: 680,
    minHeight: 520,
    show: false,
    title: 'Tangerine Settings',
    icon: path.join(iconsDir(), 'tangerine.png'),
    autoHideMenuBar: true,
    // Windows 11 Mica; Windows 10 silently falls back to the solid CSS background.
    backgroundMaterial: 'mica',
    backgroundColor: '#00000000',
    webPreferences: { preload: preloadPath(), sandbox: true, contextIsolation: true }
  })
  win.removeMenu()
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => (win = null))
  loadRoute(win, 'settings')
}

export const settingsWindow = () => (win && !win.isDestroyed() ? win : null)
