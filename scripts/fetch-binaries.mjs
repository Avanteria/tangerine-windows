#!/usr/bin/env node
/**
 * Downloads every redistributable converter into resources/bin (Windows x64):
 *
 *   ffmpeg.exe, ffprobe.exe      gyan.dev release-essentials (SHA-256 verified)
 *   imagemagick/magick.exe       ImageMagick 7 portable Q16 x64 (latest)
 *   qpdf/bin/qpdf.exe            qpdf latest GitHub release (msvc64)
 *   pandoc/pandoc.exe            Pandoc latest GitHub release (windows-x86_64)
 *
 * Ghostscript (AGPL) and LibreOffice (~350 MB) are NOT bundled; the app detects
 * them in their standard install folders. Pass --system-deps to install both
 * with winget.
 *
 * Usage:  node scripts/fetch-binaries.mjs [--force] [--only ffmpeg,magick,qpdf,pandoc] [--system-deps]
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = path.join(root, 'resources', 'bin')
const args = process.argv.slice(2)
const force = args.includes('--force')
const onlyArg = args.find((a) => a.startsWith('--only'))
const only = onlyArg ? (onlyArg.split('=')[1] ?? args[args.indexOf(onlyArg) + 1] ?? '').split(',') : null

if (process.platform !== 'win32') {
  console.error('fetch-binaries must run on Windows (it downloads Windows executables and uses PowerShell to unzip).')
  process.exit(1)
}
fs.mkdirSync(bin, { recursive: true })

const UA = { 'User-Agent': 'tangerine-windows-build' }

async function get(url, as = 'buffer') {
  const res = await fetch(url, { headers: UA, redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return as === 'json' ? res.json() : as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer())
}

async function download(url, dest) {
  process.stdout.write(`  ↓ ${url}\n`)
  const buf = await get(url)
  fs.writeFileSync(dest, buf)
  return buf
}

function unzip(archive, dest) {
  if (archive.toLowerCase().endsWith('.7z')) {
    // 7-Zip ships with Windows 11 24H2+ and GitHub's Windows runners; otherwise install it from 7-zip.org.
    const sevenZip = ['7z', 'C:\\Program Files\\7-Zip\\7z.exe'].find((c) => {
      try { execFileSync(c, ['i'], { stdio: 'ignore' }); return true } catch { return false }
    })
    if (!sevenZip) throw new Error('7-Zip is required to extract ' + path.basename(archive))
    execFileSync(sevenZip, ['x', archive, `-o${dest}`, '-y'], { stdio: 'ignore' })
    return
  }
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${dest}' -Force`], { stdio: 'inherit' })
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = findFile(p, name)
      if (hit) return hit
    } else if (entry.name.toLowerCase() === name.toLowerCase()) return p
  }
  return null
}

async function latestGithubAsset(repo, pattern) {
  const rel = await get(`https://api.github.com/repos/${repo}/releases/latest`, 'json')
  const asset = rel.assets.find((a) => pattern.test(a.name))
  if (!asset) throw new Error(`No asset matching ${pattern} in ${repo} ${rel.tag_name}`)
  return { url: asset.browser_download_url, tag: rel.tag_name, digest: asset.digest }
}

const tasks = {
  async ffmpeg(tmp) {
    if (!force && fs.existsSync(path.join(bin, 'ffmpeg.exe'))) return 'already present'
    const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
    const zip = path.join(tmp, 'ffmpeg.zip')
    const buf = await download(url, zip)
    const expected = (await get(`${url}.sha256`, 'text')).trim().split(/\s+/)[0].toLowerCase()
    const actual = createHash('sha256').update(buf).digest('hex')
    if (expected !== actual) throw new Error(`FFmpeg checksum mismatch (${actual} ≠ ${expected})`)
    unzip(zip, path.join(tmp, 'ffmpeg'))
    for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) fs.copyFileSync(findFile(path.join(tmp, 'ffmpeg'), exe), path.join(bin, exe))
    return 'ok (sha256 verified)'
  },

  async magick(tmp) {
    const dest = path.join(bin, 'imagemagick')
    if (!force && fs.existsSync(path.join(dest, 'magick.exe'))) return 'already present'
    const base = 'https://imagemagick.org/archive/binaries/'
    const listing = await get(base, 'text')
    const names = [...new Set([...listing.matchAll(/ImageMagick-7[\d.\-]+-portable-Q16-x64\.(?:zip|7z)/g)].map((m) => m[0]))]
    const byVersion = (a, b) => a.localeCompare(b, 'en', { numeric: true })
    const stem = (n) => n.replace(/\.(zip|7z)$/, '')
    const newest = names.map(stem).sort(byVersion).pop()
    // Prefer .zip (no extra tool needed); recent releases are published as .7z only.
    const latest = names.includes(`${newest}.zip`) ? `${newest}.zip` : names.includes(`${newest}.7z`) ? `${newest}.7z` : undefined
    if (!latest) throw new Error('Could not find an ImageMagick portable Q16 x64 zip')
    const zip = path.join(tmp, latest)
    await download(base + latest, zip)
    fs.rmSync(dest, { recursive: true, force: true })
    unzip(zip, path.join(tmp, 'im'))
    const magick = findFile(path.join(tmp, 'im'), 'magick.exe')
    fs.cpSync(path.dirname(magick), dest, { recursive: true })
    return `ok (${latest})`
  },

  async qpdf(tmp) {
    const dest = path.join(bin, 'qpdf')
    if (!force && fs.existsSync(path.join(dest, 'bin', 'qpdf.exe'))) return 'already present'
    const a = await latestGithubAsset('qpdf/qpdf', /msvc64\.zip$/i)
    const zip = path.join(tmp, 'qpdf.zip')
    await download(a.url, zip)
    unzip(zip, path.join(tmp, 'qpdf'))
    const exe = findFile(path.join(tmp, 'qpdf'), 'qpdf.exe')
    fs.rmSync(dest, { recursive: true, force: true })
    fs.cpSync(path.dirname(path.dirname(exe)), dest, { recursive: true })
    return `ok (${a.tag})`
  },

  async pandoc(tmp) {
    const dest = path.join(bin, 'pandoc')
    if (!force && fs.existsSync(path.join(dest, 'pandoc.exe'))) return 'already present'
    const a = await latestGithubAsset('jgm/pandoc', /windows-x86_64\.zip$/i)
    const zip = path.join(tmp, 'pandoc.zip')
    await download(a.url, zip)
    unzip(zip, path.join(tmp, 'pandoc'))
    fs.mkdirSync(dest, { recursive: true })
    fs.copyFileSync(findFile(path.join(tmp, 'pandoc'), 'pandoc.exe'), path.join(dest, 'pandoc.exe'))
    return `ok (${a.tag})`
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tangerine-bin-'))
let failed = false
try {
  for (const [name, run] of Object.entries(tasks)) {
    if (only && !only.includes(name)) continue
    process.stdout.write(`• ${name}\n`)
    try {
      console.log(`  ✓ ${await run(tmp)}`)
    } catch (err) {
      failed = true
      console.error(`  ✗ ${err.message}`)
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}

if (args.includes('--system-deps')) {
  for (const id of ['ArtifexSoftware.GhostScript', 'TheDocumentFoundation.LibreOffice']) {
    console.log(`• winget install ${id}`)
    try {
      execFileSync('winget', ['install', '--id', id, '-e', '--silent', '--accept-package-agreements', '--accept-source-agreements'], { stdio: 'inherit' })
    } catch {
      console.warn(`  ! winget could not install ${id}; install it manually.`)
    }
  }
} else {
  console.log('\nGhostscript (PDF compress / PDF→PNG) and LibreOffice (Documents→PDF) are detected at runtime.')
  console.log('Install them with:  node scripts/fetch-binaries.mjs --system-deps   (uses winget)')
}
process.exit(failed ? 1 : 0)
