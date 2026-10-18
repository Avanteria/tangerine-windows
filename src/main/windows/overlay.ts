/**
 * The radial-menu overlay. Created once at startup and kept hidden + preloaded,
 * so showing it is just setBounds() + showInactive() — well under the 100 ms budget.
 */
import { BrowserWindow, screen } from 'electron'
import { IPC } from '@shared/ipc'
import type { OverlayShowPayload } from '@shared/types'
import { preloadPath } from '../services/paths'
import { settings } from '../services/settings'
import { isDark } from '../services/theme'
import { loadRoute } from './load'

const SIZE = 520
const COMPACT = 152

class Overlay {
  private win: BrowserWindow | null = null
  private centre = { x: 0, y: 0 }
  /** Batch currently visualised by the overlay's progress ring. */
  ownedBatchId: string | null = null

  create() {
    this.win = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      title: 'Tangerine',
      webPreferences: {
        preload: preloadPath(),
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
        spellcheck: false
      }
    })
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setVisibleOnAllWorkspaces(true)
    this.win.on('blur', () => {
      // Keyboard mode: clicking elsewhere dismisses the menu (unless it is showing progress).
      if (!this.ownedBatchId) this.hide()
    })
    loadRoute(this.win, 'overlay')
  }

  get window() {
    return this.win
  }

  get visible() {
    return !!this.win?.isVisible()
  }

  /** @param point cursor position in DIPs. */
  show(point: { x: number; y: number }, mode: 'drag' | 'keyboard', ctrl: boolean, files?: string[]) {
    if (!this.win) return
    this.ownedBatchId = null
    this.centre = point
    const wa = screen.getDisplayNearestPoint(point).workArea
    // Keep the window on-screen; the menu centre stays exactly under the cursor.
    const left = Math.round(Math.min(Math.max(point.x - SIZE / 2, wa.x), wa.x + wa.width - SIZE))
    const top = Math.round(Math.min(Math.max(point.y - SIZE / 2, wa.y), wa.y + wa.height - SIZE))
    this.win.setIgnoreMouseEvents(false)
    this.win.setBounds({ x: left, y: top, width: SIZE, height: SIZE })
    const payload: OverlayShowPayload = {
      cx: point.x - left,
      cy: point.y - top,
      mode,
      ctrl,
      files,
      settings: settings.get(),
      dark: isDark()
    }
    this.win.webContents.send(IPC.overlayShow, payload)
    if (mode === 'keyboard') {
      this.win.show()
      this.win.focus()
    } else {
      // Do not steal focus from Explorer mid-drag.
      this.win.showInactive()
    }
    this.win.moveTop()
  }

  /** Shrinks to just the centre progress ring so it never blocks clicks. */
  compact() {
    if (!this.win) return
    const half = COMPACT / 2
    this.win.setBounds({ x: Math.round(this.centre.x - half), y: Math.round(this.centre.y - half), width: COMPACT, height: COMPACT })
  }

  hide() {
    this.ownedBatchId = null
    this.win?.hide()
  }

  send(channel: string, ...args: unknown[]) {
    this.win?.webContents.send(channel, ...args)
  }
}

export const overlay = new Overlay()
