/**
 * Worker Thread entry point. Runs one conversion at a time, so the Electron main
 * process (and therefore the radial menu) never blocks on parsing, staging or
 * process management. Heavy lifting is done by external native tools.
 */
import { parentPort } from 'node:worker_threads'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getActionImpl } from '../actions/registry'
import type { Step } from '../actions/types'
import type { FromWorker, ToWorker, WorkerJob } from './protocol'
import { moveInto, stageInput } from './staging'

if (!parentPort) throw new Error('worker.ts must run inside a Worker Thread')
const port = parentPort

const running = new Map<string, ChildProcess>()
const cancelled = new Set<string>()

const post = (m: FromWorker) => port.postMessage(m)
const log = (level: 'info' | 'warn' | 'error', message: string) => post({ type: 'log', level, message })

port.on('message', (msg: ToWorker) => {
  if (msg.type === 'run') void runJob(msg.job)
  if (msg.type === 'cancel') {
    cancelled.add(msg.jobId)
    killTree(running.get(msg.jobId))
  }
})

function killTree(child?: ChildProcess) {
  if (!child?.pid) return
  // taskkill /T also stops LibreOffice's soffice.bin child process.
  spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
}

class ToolError extends Error {
  constructor(message: string, readonly detail: string) {
    super(message)
  }
}

async function runJob(job: WorkerJob) {
  const impl = getActionImpl(job.actionId)
  if (!impl) return post({ type: 'error', jobId: job.jobId, error: `Unknown action ${job.actionId}` })

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tangerine-'))
  try {
    const inputs = await Promise.all(job.inputs.map((p, i) => stageInput(p, tmpDir, i)))
    const inputExt = path.extname(job.inputs[0]!).slice(1).toLowerCase()
    const outExt = impl.outputExt(inputExt)
    const stagedOut = impl.outputIsDir ? path.join(tmpDir, 'out') : path.join(tmpDir, `out.${outExt}`)
    if (impl.outputIsDir) await fs.mkdir(stagedOut)

    let duration: number | undefined
    if (impl.needsDuration && job.tools.ffprobe) duration = await probeDuration(job.tools.ffprobe, inputs[0]!)

    const steps = impl.build({ inputs, inputExt, output: stagedOut, tmpDir, quality: job.quality, duration })
    post({ type: 'progress', jobId: job.jobId, percent: duration ? 0 : null })

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      const report = (frac: number | null) => {
        if (frac === null && steps.length === 1) return post({ type: 'progress', jobId: job.jobId, percent: null })
        const pct = ((i + (frac ?? 0)) / steps.length) * 100
        post({ type: 'progress', jobId: job.jobId, percent: Math.min(99, Math.round(pct)) })
      }
      await runStep(job, step, duration, report)
      if (cancelled.has(job.jobId)) throw new Error('cancelled')
      report(1)
    }

    if (impl.outputIsDir) {
      const produced = await fs.readdir(stagedOut)
      if (produced.length === 0) throw new ToolError('The tool finished but produced no files.', '')
    } else {
      await fs.access(stagedOut).catch(() => {
        throw new ToolError('The tool finished but produced no output file.', '')
      })
    }
    await moveInto(stagedOut, job.output)
    log('info', `done ${job.actionId} → ${job.output}`)
    post({ type: 'done', jobId: job.jobId, output: job.output })
  } catch (err) {
    if (cancelled.has(job.jobId)) {
      post({ type: 'cancelled', jobId: job.jobId })
    } else {
      const e = err as Error & { detail?: string }
      log('error', `${job.actionId} failed for ${job.inputs.join(', ')}: ${e.message}\n${e.detail ?? ''}`)
      post({ type: 'error', jobId: job.jobId, error: e.message, detail: e.detail })
    }
  } finally {
    cancelled.delete(job.jobId)
    running.delete(job.jobId)
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function runStep(job: WorkerJob, step: Step, duration: number | undefined, report: (f: number | null) => void) {
  if (step.tool === '@move') {
    await moveInto(step.args[0]!, step.args[1]!)
    return
  }
  const exe = job.tools[step.tool]
  if (!exe) throw new ToolError(`Required tool "${step.tool}" is not available.`, '')

  const args = step.progress === 'ffmpeg' && duration ? ['-progress', 'pipe:1', '-nostats', ...step.args] : step.args
  log('info', `${step.tool} ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`)

  await new Promise<void>((resolve, reject) => {
    const env = { ...process.env, ...step.env }
    if (step.tool === 'magick') env.MAGICK_HOME = path.dirname(exe)
    const child = spawn(exe, args, { windowsHide: true, env })
    running.set(job.jobId, child)

    let stderrTail = ''
    child.stderr.on('data', (d: Buffer) => {
      stderrTail = (stderrTail + d.toString()).slice(-4000)
    })
    let buf = ''
    child.stdout.on('data', (d: Buffer) => {
      if (step.progress !== 'ffmpeg' || !duration) return
      buf += d.toString()
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const line of lines) {
        // out_time_us / out_time_ms are both microseconds in FFmpeg's progress protocol.
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(line)
        if (m) report(Math.min(1, Number(m[1]) / 1e6 / duration))
      }
    })
    if (step.progress !== 'ffmpeg') report(null)

    child.on('error', (err) => reject(new ToolError(`Could not start ${step.tool}: ${err.message}`, '')))
    child.on('close', (code) => {
      if (code === 0) return resolve()
      const lastLine = stderrTail.trim().split(/\r?\n/).filter(Boolean).pop() ?? `exit code ${code}`
      reject(new ToolError(`${step.tool} failed: ${lastLine}`, stderrTail))
    })
  })
}

function probeDuration(ffprobe: string, input: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const child = spawn(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', input], {
      windowsHide: true
    })
    let out = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.on('error', () => resolve(undefined))
    child.on('close', () => {
      const n = parseFloat(out.trim())
      resolve(Number.isFinite(n) && n > 0 ? n : undefined)
    })
  })
}
