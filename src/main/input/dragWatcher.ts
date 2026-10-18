/**
 * System-wide SHIFT+DRAG detection.
 *
 * Electron's globalShortcut cannot observe mouse drags, so we install a low-level
 * mouse/keyboard hook (WH_MOUSE_LL / WH_KEYBOARD_LL via uiohook-napi, prebuilt N-API).
 * The hook only watches button state, modifier flags and cursor coordinates — it
 * never reads keystrokes' content and nothing leaves the process.
 *
 * Trigger: left button down → SHIFT held → cursor moves ≥ 20 px → onTrigger().
 * The overlay then appears under the cursor and becomes the OLE drop target, so
 * Windows hands us the dragged file paths when the user releases over a segment.
 */
import { screen } from 'electron'
import { uIOhook, type UiohookMouseEvent } from 'uiohook-napi'
import { logger } from '../services/logger'

const THRESHOLD_PX = 20
// libuiohook event type ids
const EVENT_MOUSE_PRESSED = 7
const EVENT_MOUSE_RELEASED = 8
const EVENT_MOUSE_MOVED = 9
const EVENT_MOUSE_DRAGGED = 10
const LEFT_BUTTON = 1

export interface DragWatcherHandlers {
  onTrigger: (point: { x: number; y: number }, ctrl: boolean) => void
  onEnd: () => void
  /** Return true to ignore a drag (e.g. it started on our own overlay). */
  shouldIgnore: () => boolean
}

let started = false
let enabled = true
let origin: { x: number; y: number } | null = null
let triggered = false

export function setDragWatcherEnabled(on: boolean) {
  enabled = on
  if (!on) origin = null
}

export function startDragWatcher(h: DragWatcherHandlers) {
  if (started) return
  started = true

  uIOhook.on('input', (raw) => {
    if (!enabled) return
    const e = raw as UiohookMouseEvent
    switch (e.type as number) {
      case EVENT_MOUSE_PRESSED:
        if (e.button === LEFT_BUTTON) {
          origin = { x: e.x, y: e.y }
          triggered = false
        }
        break
      case EVENT_MOUSE_MOVED:
      case EVENT_MOUSE_DRAGGED: {
        if (!origin || triggered || !e.shiftKey) return
        const dx = e.x - origin.x
        const dy = e.y - origin.y
        if (dx * dx + dy * dy < THRESHOLD_PX * THRESHOLD_PX) return
        if (h.shouldIgnore()) {
          origin = null
          return
        }
        triggered = true
        // The hook reports physical pixels; convert for per-monitor DPI (4K @ 150 % etc.).
        const point = screen.screenToDipPoint({ x: e.x, y: e.y })
        h.onTrigger(point, !!e.ctrlKey)
        break
      }
      case EVENT_MOUSE_RELEASED:
        if (e.button === LEFT_BUTTON) {
          if (triggered) h.onEnd()
          origin = null
          triggered = false
        }
        break
    }
  })

  try {
    uIOhook.start()
    logger.info('Shift-drag watcher started')
  } catch (err) {
    logger.error(`Could not start the input hook: ${(err as Error).message}`)
  }
}

export function stopDragWatcher() {
  if (!started) return
  try {
    uIOhook.stop()
  } catch {
    /* already stopped */
  }
  started = false
}
