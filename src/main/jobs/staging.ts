/**
 * Long-path (>260 chars) safety.
 * Node's fs handles long paths natively on Windows, but many bundled CLI tools
 * (ImageMagick, Ghostscript, LibreOffice) do not. Inputs with long paths are
 * hard-linked (or copied, across volumes) into a short temp folder, and every
 * tool always writes into the temp folder; the result is then moved with fs.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

export const MAX_TOOL_PATH = 240

export async function stageInput(p: string, tmpDir: string, index: number): Promise<string> {
  if (p.length < MAX_TOOL_PATH && !/[\[\]]/.test(path.basename(p))) return p
  // Long path, or brackets that ImageMagick would read as a frame selector.
  const staged = path.join(tmpDir, `in-${index}${path.extname(p).toLowerCase()}`)
  try {
    await fs.link(p, staged)
  } catch {
    await fs.copyFile(p, staged)
  }
  return staged
}

/** Move a file or folder, falling back to copy+delete across volumes. */
export async function moveInto(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true })
  try {
    await fs.rename(src, dest)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
    await fs.cp(src, dest, { recursive: true, errorOnExist: true, force: false })
    await fs.rm(src, { recursive: true, force: true })
  }
}
