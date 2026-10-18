#!/usr/bin/env node
/** Pre-packaging check: refuse to build an installer without the bundled converters. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'bin')
const required = ['ffmpeg.exe', 'ffprobe.exe', 'imagemagick/magick.exe', 'qpdf/bin/qpdf.exe', 'pandoc/pandoc.exe']
const missing = required.filter((r) => !fs.existsSync(path.join(bin, r)))
if (missing.length) {
  console.error(`Missing bundled tools in resources/bin:\n  ${missing.join('\n  ')}\nRun: npm run fetch:bin`)
  process.exit(1)
}
console.log('All bundled tools present.')
