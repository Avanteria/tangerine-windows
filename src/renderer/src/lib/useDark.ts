import { useEffect, useState } from 'react'

/** Tracks the Windows light/dark theme pushed from the main process. */
export function useDark(initial = true) {
  const [dark, setDark] = useState(initial)
  useEffect(() => window.tangerine.onThemeChanged(setDark), [])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])
  return [dark, setDark] as const
}
