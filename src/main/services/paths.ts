import path from 'node:path'
import { app } from 'electron'

/** resources/ in dev, <install>/resources in a packaged build (see extraResources). */
export function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
}

export const binDir = () => path.join(resourcesDir(), 'bin')
export const iconsDir = () => path.join(resourcesDir(), 'icons')

export function rendererUrl(route: 'overlay' | 'settings' | 'toast'): { url?: string; file?: string; hash: string } {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && dev) return { url: `${dev}#/${route}`, hash: route }
  return { file: path.join(__dirname, '../renderer/index.html'), hash: `/${route}` }
}

export const preloadPath = () => path.join(__dirname, '../preload/index.js')
