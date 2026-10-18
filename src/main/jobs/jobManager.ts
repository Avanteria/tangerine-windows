/**
 * Turns a RunRequest (action + dropped files) into queued worker jobs:
 * validates the files, checks tools, resolves output paths, tracks batches
 * and reports progress/completion back to the UI.
 */
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { ACTIONS_BY_ID, actionFits } from '@shared/actions'
import { extOf, kindFromPath, KIND_LABEL } from '@shared/fileKinds'
import type { JobUpdate, RunRequest, RunResult } from '@shared/types'
import { getActionImpl } from '../actions/registry'
import { JobQueue } from './jobQueue'
import type { WorkerJob } from './protocol'
import { settings } from '../services/settings'
import { resolveTool } from '../services/tools'
import { outputTargetFor, saveAsFor, uniqueOutputPath } from '../services/output'
import { logger } from '../services/logger'

export interface Batch {
  id: string
  actionId: string
  jobs: Map<string, JobUpdate>
}

interface Hooks {
  onUpdate: (u: JobUpdate) => void
  onBatchFinished: (b: Batch) => void
}

export class JobManager {
  private queue = new JobQueue()
  private batches = new Map<string, Batch>()
  private jobToBatch = new Map<string, string>()

  constructor(private hooks: Hooks) {
    this.queue.on('progress', (id, percent) => this.patch(id, { status: 'running', percent }))
    this.queue.on('done', (id, output) => this.patch(id, { status: 'done', percent: 100, output }))
    this.queue.on('error', (id, error) => this.patch(id, { status: 'error', error }))
    this.queue.on('cancelled', (id) => this.patch(id, { status: 'cancelled' }))
  }

  get busy() {
    return this.queue.activeCount > 0
  }

  cancel(jobId: string) {
    this.queue.cancel(jobId)
  }

  async run(req: RunRequest): Promise<RunResult> {
    const desc = ACTIONS_BY_ID.get(req.actionId)
    const impl = getActionImpl(req.actionId)
    if (!desc || !impl) return { ok: false, error: 'Unknown action.' }

    const s = settings.get()
    if (!s.enabledKinds[desc.kind]) return { ok: false, error: `${KIND_LABEL[desc.kind]} files are disabled in Settings.` }

    const files = [...new Set(req.files)].filter((f) => {
      try {
        return fs.statSync(f).isFile()
      } catch {
        return false
      }
    })
    if (files.length === 0) return { ok: false, error: 'No readable files were dropped.' }

    const wrongKind = files.find((f) => kindFromPath(f) !== desc.kind)
    if (wrongKind) return { ok: false, error: `"${path.basename(wrongKind)}" is not a ${KIND_LABEL[desc.kind].toLowerCase()} file.` }
    const unfit = files.find((f) => !actionFits(desc, extOf(f), files.length))
    if (unfit) {
      return { ok: false, error: desc.minFiles && files.length < desc.minFiles
        ? `${desc.hint} needs at least ${desc.minFiles} files.`
        : `${desc.hint} does not support .${extOf(unfit)} files.` }
    }

    const tools: WorkerJob['tools'] = {}
    for (const t of desc.tools) {
      const st = resolveTool(t)
      if (!st.path) return { ok: false, error: `${st.label} was not found. Install it or set its location in Settings → Tools.` }
      tools[t] = st.path
    }

    // One job per file, or a single job consuming every file (merge).
    const groups = desc.batch === 'merge' ? [files] : files.map((f) => [f])
    const target = await outputTargetFor(files[0]!, s, groups.length)
    if ('cancelled' in target) return { ok: false, error: 'Cancelled.' }

    const batch: Batch = { id: randomUUID(), actionId: desc.id, jobs: new Map() }
    const reserved = new Set<string>()
    const jobs: WorkerJob[] = []
    for (const inputs of groups) {
      const first = inputs[0]!
      const ext = impl.outputExt(extOf(first))
      const suffix = impl.suffix ?? s.suffix
      let output: string
      if ('dir' in target) output = uniqueOutputPath(target.dir, first, suffix, ext, reserved)
      else {
        const suggested = uniqueOutputPath(path.dirname(first), first, suffix, ext, reserved)
        const picked = await saveAsFor(suggested)
        if (!picked) return { ok: false, error: 'Cancelled.' }
        output = picked
      }
      const job: WorkerJob = { jobId: randomUUID(), actionId: desc.id, inputs, output, quality: s.quality, tools }
      jobs.push(job)
      batch.jobs.set(job.jobId, { batchId: batch.id, jobId: job.jobId, actionId: desc.id, file: first, status: 'queued', percent: 0 })
      this.jobToBatch.set(job.jobId, batch.id)
    }
    this.batches.set(batch.id, batch)
    logger.info(`Batch ${batch.id}: ${desc.id} × ${jobs.length}`)
    for (const j of jobs) this.queue.enqueue(j)
    return { ok: true, batchId: batch.id, jobIds: jobs.map((j) => j.jobId) }
  }

  private patch(jobId: string, p: Partial<JobUpdate>) {
    const batchId = this.jobToBatch.get(jobId)
    const batch = batchId ? this.batches.get(batchId) : undefined
    const job = batch?.jobs.get(jobId)
    if (!batch || !job) return
    Object.assign(job, p)
    this.hooks.onUpdate({ ...job })
    const finished = [...batch.jobs.values()].every((j) => ['done', 'error', 'cancelled'].includes(j.status))
    if (finished) {
      this.batches.delete(batch.id)
      for (const id of batch.jobs.keys()) this.jobToBatch.delete(id)
      this.hooks.onBatchFinished(batch)
    }
  }
}
