/**
 * Fixed-size Worker Thread pool + FIFO queue. Each worker handles one job at a time;
 * concurrency defaults to 2 because FFmpeg itself is already multi-threaded.
 */
import { Worker } from 'node:worker_threads'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { FromWorker, WorkerJob } from './protocol'
import { logger } from '../services/logger'

export interface JobEvents {
  progress: (jobId: string, percent: number | null) => void
  done: (jobId: string, output: string) => void
  error: (jobId: string, error: string) => void
  cancelled: (jobId: string) => void
}

interface Slot {
  worker: Worker
  busyWith: string | null
}

export class JobQueue extends EventEmitter {
  private slots: Slot[] = []
  private pending: WorkerJob[] = []
  private readonly size: number

  constructor(private readonly workerPath = path.join(__dirname, 'worker.js')) {
    super()
    this.size = Math.max(1, Math.min(3, Math.floor(os.availableParallelism() / 4)))
  }

  override on<E extends keyof JobEvents>(event: E, listener: JobEvents[E]): this {
    return super.on(event, listener)
  }

  enqueue(job: WorkerJob) {
    this.pending.push(job)
    this.pump()
  }

  cancel(jobId: string) {
    const idx = this.pending.findIndex((j) => j.jobId === jobId)
    if (idx >= 0) {
      this.pending.splice(idx, 1)
      this.emit('cancelled', jobId)
      return
    }
    this.slots.find((s) => s.busyWith === jobId)?.worker.postMessage({ type: 'cancel', jobId })
  }

  get activeCount() {
    return this.slots.filter((s) => s.busyWith).length + this.pending.length
  }

  /** Workers are created lazily so idle memory stays low. */
  private pump() {
    while (this.pending.length) {
      let slot = this.slots.find((s) => !s.busyWith)
      if (!slot && this.slots.length < this.size) slot = this.spawn()
      if (!slot) return
      const job = this.pending.shift()!
      slot.busyWith = job.jobId
      slot.worker.postMessage({ type: 'run', job })
    }
  }

  private spawn(): Slot {
    const slot: Slot = { worker: new Worker(this.workerPath), busyWith: null }
    slot.worker.on('message', (m: FromWorker) => this.onMessage(slot, m))
    slot.worker.on('error', (err) => {
      logger.error(`Worker crashed: ${err.stack ?? err.message}`)
      if (slot.busyWith) this.emit('error', slot.busyWith, `Internal error: ${err.message}`)
      this.slots = this.slots.filter((s) => s !== slot)
      this.pump()
    })
    this.slots.push(slot)
    return slot
  }

  private onMessage(slot: Slot, m: FromWorker) {
    switch (m.type) {
      case 'log':
        logger[m.level](`[worker] ${m.message}`)
        return
      case 'progress':
        this.emit('progress', m.jobId, m.percent)
        return
      case 'done':
        this.emit('done', m.jobId, m.output)
        break
      case 'error':
        this.emit('error', m.jobId, m.error)
        break
      case 'cancelled':
        this.emit('cancelled', m.jobId)
        break
    }
    slot.busyWith = null
    this.pump()
    this.reapIdle()
  }

  /** Terminate idle workers after a quiet period to return memory to the OS. */
  private reapTimer: NodeJS.Timeout | null = null
  private reapIdle() {
    if (this.reapTimer) clearTimeout(this.reapTimer)
    this.reapTimer = setTimeout(() => {
      if (this.activeCount > 0) return
      for (const s of this.slots) void s.worker.terminate()
      this.slots = []
    }, 60_000)
  }
}
