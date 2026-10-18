import { app } from 'electron'

export function applyLaunchOnStartup(enabled: boolean) {
  if (!app.isPackaged) return // never register the dev electron.exe
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
}
