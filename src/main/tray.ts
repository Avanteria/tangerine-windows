import path from 'node:path'
import { Menu, Tray, nativeImage, shell, app } from 'electron'
import { iconsDir } from './services/paths'
import { settings } from './services/settings'
import { logger } from './services/logger'
import { openSettings } from './windows/settingsWindow'

let tray: Tray | null = null

export function createTray() {
  const icon = nativeImage.createFromPath(path.join(iconsDir(), 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Tangerine — Shift-drag a file to convert it (100% local)')
  tray.on('click', openSettings)
  refreshTrayMenu()
  settings.on('change', refreshTrayMenu)
}

export function refreshTrayMenu() {
  if (!tray) return
  const s = settings.get()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Tangerine · 100% Local Processing', enabled: false },
      { type: 'separator' },
      {
        label: 'Shift-drag menu enabled',
        type: 'checkbox',
        checked: s.shiftDragEnabled,
        click: (item) => settings.set({ shiftDragEnabled: item.checked })
      },
      { label: 'Settings…', click: openSettings },
      { label: 'Open Logs', click: () => void shell.openPath(logger.dir) },
      { type: 'separator' },
      { label: 'Quit Tangerine', click: () => app.quit() }
    ])
  )
}
