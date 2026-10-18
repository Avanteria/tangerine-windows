import { nativeTheme } from 'electron'
import { settings } from './settings'

/** Applies the theme preference and reports whether dark UI should be used. */
export function applyThemeSource() {
  nativeTheme.themeSource = settings.get().theme
}

export const isDark = () => nativeTheme.shouldUseDarkColors
