#!/usr/bin/env node
/** Writes the icon files stored as base64 in build/binary-assets.b64.json (text-only repositories). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = JSON.parse(fs.readFileSync(path.join(root, 'build', 'binary-assets.b64.json'), 'utf8'))
for (const [rel, b64] of Object.entries(assets)) {
  const dest = path.join(root, rel)
  if (fs.existsSync(dest)) continue
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, Buffer.from(b64, 'base64'))
  console.log(`restored ${rel}`)
}
