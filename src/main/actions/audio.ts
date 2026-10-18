import type { ActionImpl, BuildContext, Step } from './types'
import { pick } from './types'

const ff = (ctx: BuildContext, codec: string[]): Step => ({
  tool: 'ffmpeg',
  // -vn drops embedded cover art streams that some containers cannot hold.
  args: ['-hide_banner', '-y', '-i', ctx.inputs[0]!, '-vn', '-map_metadata', '0', ...codec, ctx.output],
  progress: 'ffmpeg'
})

export const audioActions: ActionImpl[] = [
  {
    id: 'audio.to-mp3',
    outputExt: () => 'mp3',
    needsDuration: true,
    build: (ctx) => [ff(ctx, ['-c:a', 'libmp3lame', '-b:a', pick(ctx.quality, '320k', '192k', '128k')])]
  },
  {
    id: 'audio.to-wav',
    outputExt: () => 'wav',
    needsDuration: true,
    build: (ctx) => [ff(ctx, ['-c:a', 'pcm_s16le'])]
  },
  {
    id: 'audio.to-m4a',
    outputExt: () => 'm4a',
    needsDuration: true,
    build: (ctx) => [ff(ctx, ['-c:a', 'aac', '-b:a', pick(ctx.quality, '256k', '192k', '128k'), '-movflags', '+faststart'])]
  },
  {
    id: 'audio.to-flac',
    outputExt: () => 'flac',
    needsDuration: true,
    build: (ctx) => [ff(ctx, ['-c:a', 'flac', '-compression_level', String(pick(ctx.quality, 5, 5, 8))])]
  }
]
