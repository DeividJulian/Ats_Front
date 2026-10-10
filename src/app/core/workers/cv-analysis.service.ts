import { Injectable, signal } from '@angular/core';

import { AnalysisJob, AnalysisOutput, analyze } from './cv-analysis.logic';

export type AnalysisMode = 'worker' | 'main';

export interface AnalysisRun {
  mode: AnalysisMode;
  output: AnalysisOutput;
  /** Total time measured from the screen (includes handing the data to the worker) */
  wallMs: number;
}

/** Runs the analysis on a Web Worker (separate thread) or, to compare, on the main thread. */
@Injectable({ providedIn: 'root' })
export class CvAnalysisService {
  readonly running = signal(false);
  readonly progress = signal(0);
  readonly mode = signal<AnalysisMode>('worker');
  readonly workerSupported = typeof Worker !== 'undefined';

  private worker: Worker | null = null;

  async run(job: AnalysisJob, mode: AnalysisMode): Promise<AnalysisRun> {
    this.running.set(true);
    this.progress.set(0);
    this.mode.set(mode);
    const started = performance.now();
    try {
      const output = mode === 'worker' ? await this.runInWorker(job) : await this.runOnMainThread(job);
      return { mode, output, wallMs: Math.round(performance.now() - started) };
    } finally {
      this.running.set(false);
    }
  }

  cancel(): void {
    this.worker?.terminate();
    this.worker = null;
    this.running.set(false);
  }

  private runInWorker(job: AnalysisJob): Promise<AnalysisOutput> {
    if (!this.workerSupported) return Promise.reject(new Error('Este navegador no soporta Web Workers'));

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./cv-analysis.worker', import.meta.url), { type: 'module' });
      this.worker = worker;
      const finish = () => {
        worker.terminate();
        this.worker = null;
      };

      worker.onmessage = ({ data }: MessageEvent) => {
        if (data.type === 'progress') {
          this.progress.set(data.progress);
        } else if (data.type === 'result') {
          finish();
          resolve(data.output as AnalysisOutput);
        } else if (data.type === 'error') {
          finish();
          reject(new Error(data.message));
        }
      };
      worker.onerror = (event) => {
        finish();
        reject(new Error(event.message || 'El worker falló'));
      };
      worker.postMessage(job);
    });
  }

  private async runOnMainThread(job: AnalysisJob): Promise<AnalysisOutput> {
    // Yield for a moment so the screen shows "processing" before the thread blocks
    await new Promise((resolve) => setTimeout(resolve, 60));
    return analyze(job, (fraction) => this.progress.set(fraction));
  }
}
