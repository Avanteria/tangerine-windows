/** Every IPC channel name in one place, so main / preload / renderer never drift apart. */
export const IPC = {
  // renderer → main (invoke)
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  toolsStatus: 'tools:status',
  jobsRun: 'jobs:run',
  jobsCancel: 'jobs:cancel',
  pickFolder: 'dialog:pick-folder',
  pickFile: 'dialog:pick-file',
  // renderer → main (send)
  overlayHide: 'overlay:hide',
  overlayCompact: 'overlay:compact',
  openLogs: 'shell:open-logs',
  showItem: 'shell:show-item',
  openUrl: 'shell:open-url',
  openSettings: 'app:open-settings',
  toastClose: 'toast:close',
  // main → renderer
  overlayShow: 'overlay:show',
  dragEnded: 'overlay:drag-ended',
  jobUpdate: 'jobs:update',
  settingsChanged: 'settings:changed',
  themeChanged: 'theme:changed',
  toastShow: 'toast:show'
} as const
