import type { ActionImpl, BuildContext } from './types'
import { pick } from './types'

/** Formats ImageMagick should not write back as-is: fall back to a widely supported one. */
function writableExt(inputExt: string): string {
  if (inputExt === 'heic' || inputExt === 'heif') return 'jpg'
  if (inputExt === 'svg') return 'png'
  if (inputExt === 'jpeg') return 'jpg'
  if (inputExt === 'tif') return 'tiff'
  return inputExt
}

/** Multi-frame sources: only take the first frame for single-image outputs. */
function src(ctx: BuildContext, firstFrameOnly: boolean): string {
  const multi = ['gif', 'tif', 'tiff', 'heic', 'heif'].includes(ctx.inputExt)
  return firstFrameOnly && multi ? `${ctx.inputs[0]}[0]` : ctx.inputs[0]!
}

const quality = (ctx: BuildContext) => String(pick(ctx.quality, 92, 82, 65))

/** Extra flags so lossless formats actually shrink when "compressing". */
function encoderFlags(ext: string, ctx: BuildContext): string[] {
  if (ext === 'png') return ['-define', 'png:compression-level=9', '-define', 'png:compression-filter=5']
  if (ext === 'jpg' || ext === 'webp') return ['-quality', quality(ctx)]
  return []
}

export const imageActions: ActionImpl[] = [
  {
    id: 'image.to-png',
    outputExt: () => 'png',
    build: (ctx) => [{ tool: 'magick', args: [src(ctx, true), ...encoderFlags('png', ctx), ctx.output] }]
  },
  {
    id: 'image.to-jpg',
    outputExt: () => 'jpg',
    build: (ctx) => [{
      tool: 'magick',
      // Flatten transparency onto white – JPG has no alpha channel.
      args: [src(ctx, true), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-quality', quality(ctx), ctx.output]
    }]
  },
  {
    id: 'image.to-webp',
    outputExt: () => 'webp',
    build: (ctx) => [{ tool: 'magick', args: [src(ctx, true), '-quality', quality(ctx), ctx.output] }]
  },
  {
    id: 'image.compress',
    outputExt: writableExt,
    build: (ctx) => {
      const ext = writableExt(ctx.inputExt)
      return [{ tool: 'magick', args: [src(ctx, ext !== 'gif'), '-strip', ...encoderFlags(ext, ctx), ctx.output] }]
    }
  },
  {
    id: 'image.resize-50',
    outputExt: writableExt,
    build: (ctx) => [{ tool: 'magick', args: [src(ctx, false), '-resize', '50%', ctx.output] }]
  },
  {
    id: 'image.rotate-90',
    outputExt: writableExt,
    build: (ctx) => [{ tool: 'magick', args: [src(ctx, false), '-auto-orient', '-rotate', '90', ctx.output] }]
  }
]
