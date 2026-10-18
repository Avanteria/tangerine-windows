import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { TangerineApi } from '@shared/api'

function on<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: TangerineApi = {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  toolsStatus: () => ipcRenderer.invoke(IPC.toolsStatus),
  runAction: (req) => ipcRenderer.invoke(IPC.jobsRun, req),
  cancelJob: (id) => ipcRenderer.invoke(IPC.jobsCancel, id),
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder),
  pickFile: (tool) => ipcRenderer.invoke(IPC.pickFile, tool),
  hideOverlay: () => ipcRenderer.send(IPC.overlayHide),
  compactOverlay: () => ipcRenderer.send(IPC.overlayCompact),
  openLogs: () => ipcRenderer.send(IPC.openLogs),
  showItem: (p) => ipcRenderer.send(IPC.showItem, p),
  openUrl: (u) => ipcRenderer.send(IPC.openUrl, u),
  openSettings: () => ipcRenderer.send(IPC.openSettings),
  closeToast: () => ipcRenderer.send(IPC.toastClose),
  onOverlayShow: (cb) => on(IPC.overlayShow, cb),
  onDragEnded: (cb) => on(IPC.dragEnded, cb),
  onJobUpdate: (cb) => on(IPC.jobUpdate, cb),
  onSettingsChanged: (cb) => on(IPC.settingsChanged, cb),
  onThemeChanged: (cb) => on(IPC.themeChanged, cb),
  onToast: (cb) => on(IPC.toastShow, cb)
}

contextBridge.exposeInMainWorld('tangerine', api)
