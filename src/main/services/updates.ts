/**
 * The ONLY network call the app ever makes: an optional check of the latest GitHub
 * release tag. No identifiers, no telemetry, nothing about the user's files.
 */
import { app, net } from 'electron'
import { logger } from './logger'

interface PkgMeta {
  tangerine?: { updateRepo?: string }
}

function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}

export async function checkForUpdates(): Promise<{ version: string; url: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(`${app.getAppPath()}/package.json`) as PkgMeta
    const repo = pkg.tangerine?.updateRepo
    if (!repo || repo.startsWith('your-org/')) return null
    const res = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Tangerine-Windows' }
    })
    if (!res.ok) return null
    const json = (await res.json()) as { tag_name?: string; html_url?: string }
    if (json.tag_name && json.html_url && newer(json.tag_name, app.getVersion())) {
      return { version: json.tag_name, url: json.html_url }
    }
  } catch (err) {
    logger.warn(`Update check skipped: ${(err as Error).message}`)
  }
  return null
}
