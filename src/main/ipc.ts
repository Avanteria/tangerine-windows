import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { RunRequest, Settings, ToolName } from '@shared/types'
import { settings } from './services/settings'
import { allToolStatus } from './services/tools'
import { logger } from './services/logger'
import { overlay } from './windows/overlay'
import { hideToast } from './windows/toast'
import { openSettings } from './windows/settingsWindow'
import type { JobManager } from './jobs/jobManager'

export function registerIpc(jobs: JobManager) {
  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsSet, (_e, patch: Partial<Settings>) => settings.set(patch))
  ipcMain.handle(IPC.toolsStatus, () => allToolStatus())

  ipcMain.handle(IPC.jobsRun, async (e, req: RunRequest) => {
    const res = await jobs.run(req)
    if (res.ok && BrowserWindow.fromWebContents(e.sender) === overlay.window) overlay.ownedBatchId = res.batchId
    return res
  })
  ipcMain.handle(IPC.jobsCancel, (_e, jobId: string) => jobs.cancel(jobId))

  ipcMain.handle(IPC.pickFolder, async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(parent!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })
  ipcMain.handle(IPC.pickFile, async (e, tool: ToolName) => {
    const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const r = await dialog.showOpenDialog(parent!, {
      title: `Locate ${tool}`,
      properties: ['openFile'],
      filters: [{ name: 'Programs', extensions: ['exe'] }]
    })
    return r.canceled ? null : (r.filePaths[0] ?? null)
  })

  ipcMain.on(IPC.overlayHide, () => overlay.hide())
  ipcMain.on(IPC.overlayCompact, () => overlay.compact())
  ipcMain.on(IPC.openLogs, () => void shell.openPath(logger.filePath))
  ipcMain.on(IPC.showItem, (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.on(IPC.openUrl, (_e, url: string) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
  })
  ipcMain.on(IPC.openSettings, () => openSettings())
  ipcMain.on(IPC.toastClose, () => hideToast())
}
