/**
 * Tangerine for Windows — main process entry.
 * Tray app: no main window. A hidden, preloaded overlay hosts the radial menu.
 */
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, nativeTheme, screen } from 'electron'
import { IPC } from '@shared/ipc'
import { ACTIONS_BY_ID } from '@shared/actions'
import { settings } from './services/settings'
import { logger } from './services/logger'
import { applyThemeSource, isDark } from './services/theme'
import { checkForUpdates } from './services/updates'
import { verifyRegistry } from './actions/registry'
import { JobManager } from './jobs/jobManager'
import { registerIpc } from './ipc'
import { overlay } from './windows/overlay'
import { showToast } from './windows/toast'
import { openSettings, settingsWindow } from './windows/settingsWindow'
import { createTray } from './tray'
import { setDragWatcherEnabled, startDragWatcher, stopDragWatcher } from './input/dragWatcher'
import { parseOpenArgs, registerContextMenu, unregisterContextMenu } from './integration/contextMenu'
import { applyLaunchOnStartup } from './integration/startup'

// ── Single instance: Explorer's "Convert with Tangerine" re-launches the exe. ──
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  main()
}

function main() {
  app.setAppUserModelId('com.tangerine.windows')
  // Lower idle footprint: the app is mostly a hidden tray process.
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,SpareRendererForSitePerProcess')

  // Explorer "Player" multi-select launches one process per file: collect them for 200 ms.
  let pendingOpen: string[] = []
  let openTimer: NodeJS.Timeout | null = null
  const queueOpen = (files: string[]) => {
    if (!files.length) return
    pendingOpen.push(...files)
    if (openTimer) clearTimeout(openTimer)
    openTimer = setTimeout(() => {
      const files = pendingOpen
      pendingOpen = []
      overlay.show(screen.getCursorScreenPoint(), 'keyboard', files.length > 1, files)
    }, 200)
  }
  app.on('second-instance', (_e, argv) => {
    const files = parseOpenArgs(argv)
    if (files.length) queueOpen(files)
    else openSettings()
  })

  app.whenReady().then(async () => {
    const started = Date.now()
    settings.load()
    applyThemeSource()
    const problems = verifyRegistry()
    if (problems.length) logger.error(`Action registry problems:\n${problems.join('\n')}`)

    const jobs = new JobManager({
      onUpdate: (u) => overlay.send(IPC.jobUpdate, u),
      onBatchFinished: (batch) => {
        const all = [...batch.jobs.values()]
        const failed = all.filter((j) => j.status === 'error')
        const done = all.filter((j) => j.status === 'done')
        const label = ACTIONS_BY_ID.get(batch.actionId)?.hint ?? 'Conversion'
        if (failed.length) {
          void showToast({
            level: 'error',
            title: failed.length === all.length ? `${label} failed` : `${failed.length} of ${all.length} files failed`,
            message: failed[0]!.error,
            action: { label: 'Open Logs', kind: 'open-logs' }
          })
        } else if (done.length && (overlay.ownedBatchId !== batch.id || !overlay.visible)) {
          // The overlay already shows a ✓ for its own batch; toast only when it is gone.
          void showToast({
            level: 'success',
            title: done.length === 1 ? 'Converted 1 file' : `Converted ${done.length} files`,
            message: path.basename(done[0]!.output ?? ''),
            action: { label: 'Show in folder', kind: 'show-item', target: done[0]!.output }
          })
        }
      }
    })
    registerIpc(jobs)

    overlay.create()
    createTray()

    startDragWatcher({
      onTrigger: (point, ctrl) => overlay.show(point, 'drag', ctrl),
      onEnd: () => overlay.send(IPC.dragEnded),
      // Ignore drags that begin on the overlay itself or inside Settings.
      shouldIgnore: () => {
        const focused = BrowserWindow.getFocusedWindow()
        return !!focused && (focused === overlay.window || focused === settingsWindow())
      }
    })
    setDragWatcherEnabled(settings.get().shiftDragEnabled)

    applyLaunchOnStartup(settings.get().launchOnStartup)
    void syncContextMenu(settings.get().contextMenu)

    settings.on('change', (s, prev) => {
      if (s.theme !== prev.theme) applyThemeSource()
      if (s.launchOnStartup !== prev.launchOnStartup) applyLaunchOnStartup(s.launchOnStartup)
      if (s.contextMenu !== prev.contextMenu) void syncContextMenu(s.contextMenu, true)
      if (s.shiftDragEnabled !== prev.shiftDragEnabled) setDragWatcherEnabled(s.shiftDragEnabled)
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.settingsChanged, s)
    })
    nativeTheme.on('updated', () => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send(IPC.themeChanged, isDark())
    })

    // Launched from the context menu while not running.
    queueOpen(parseOpenArgs(process.argv))

    if (settings.get().checkForUpdates) {
      setTimeout(async () => {
        const update = await checkForUpdates()
        if (update) {
          void showToast({
            level: 'info',
            title: `Tangerine ${update.version} is available`,
            message: 'Download the new version from the release page.',
            action: { label: 'Download', kind: 'open-url', target: update.url }
          })
        }
      }, 15_000)
    }
    logger.info(`Ready in ${Date.now() - started} ms (v${app.getVersion()})`)
  })

  // Tray app: closing Settings must not quit.
  app.on('window-all-closed', () => undefined)
  app.on('will-quit', () => stopDragWatcher())
}

/** Registry writes are slow-ish, so only re-register when the command line changed. */
async function syncContextMenu(enabled: boolean, force = false) {
  const marker = path.join(app.getPath('userData'), 'context-menu.json')
  if (!enabled) {
    await unregisterContextMenu()
    fs.rmSync(marker, { force: true })
    return
  }
  const signature = `${process.execPath}|${app.getVersion()}`
  try {
    if (!force && fs.readFileSync(marker, 'utf8') === signature) return
  } catch {
    /* first run */
  }
  await registerContextMenu()
  fs.writeFileSync(marker, signature)
}
