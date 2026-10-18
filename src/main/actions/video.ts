import type { ActionImpl, BuildContext, Step } from './types'
import { pick } from './types'

const base = (ctx: BuildContext) => ['-hide_banner', '-y', '-i', ctx.inputs[0]!]
const ff = (args: string[]): Step => ({ tool: 'ffmpeg', args, progress: 'ffmpeg' })

/** Even dimensions, never upscale, cap the long edge at 1920 (portrait-safe). */
const CAP_1080P = "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'"

export const videoActions: ActionImpl[] = [
  {
    id: 'video.to-mp4',
    outputExt: () => 'mp4',
    needsDuration: true,
    build: (ctx) => [ff([
      ...base(ctx),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(pick(ctx.quality, 18, 22, 27)),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', ctx.output
    ])]
  },
  {
    id: 'video.compress',
    outputExt: () => 'mp4',
    needsDuration: true,
    // "veryfast" keeps a 100 MB clip comfortably under the 30 s target on a modern 8-core CPU.
    build: (ctx) => [ff([
      ...base(ctx),
      '-vf', CAP_1080P,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(pick(ctx.quality, 23, 27, 31)),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', pick(ctx.quality, '160k', '128k', '96k'),
      '-movflags', '+faststart', '-threads', '0', ctx.output
    ])]
  },
  {
    id: 'video.extract-audio',
    outputExt: () => 'mp3',
    needsDuration: true,
    build: (ctx) => [ff([...base(ctx), '-vn', '-c:a', 'libmp3lame', '-q:a', String(pick(ctx.quality, 0, 2, 5)), ctx.output])]
  },
  {
    id: 'video.to-gif',
    outputExt: () => 'gif',
    needsDuration: true,
    build: (ctx) => {
      const width = pick(ctx.quality, 720, 480, 360)
      const fps = pick(ctx.quality, 15, 12, 10)
      return [ff([
        ...base(ctx),
        '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`,
        '-loop', '0', ctx.output
      ])]
    }
  },
  {
    id: 'video.extract-frame',
    outputExt: () => 'png',
    needsDuration: true,
    build: (ctx) => {
      // Grab a representative frame: 1 s in, or the middle of very short clips.
      const at = Math.max(0, Math.min(1, (ctx.duration ?? 2) / 2))
      return [{ tool: 'ffmpeg', args: ['-hide_banner', '-y', '-ss', at.toFixed(2), '-i', ctx.inputs[0]!, '-frames:v', '1', ctx.output] }]
    }
  }
]
