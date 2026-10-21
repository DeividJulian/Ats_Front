import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Activity, CircleCheck, Download, Info, Layers, TriangleAlert, Trophy, Zap } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { Candidate, Job } from '../../../core/models';
import { CandidateService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { AnalysisJob, EducationKey, ResumeInput, ResumeResult } from '../../../core/workers/cv-analysis.logic';
import { AnalysisMode, AnalysisRun, CvAnalysisService } from '../../../core/workers/cv-analysis.service';
import { csvFileName, downloadCsv, toCsv } from '../../../core/utils/csv';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';
import { YearsPipe } from '../../../shared/years.pipe';

/** Splits pasted text into resumes: one per block separated by a line with "---". */
export function parsePastedResumes(text: string): ResumeInput[] {
  return text
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, i) => ({ name: block.split('\n')[0].slice(0, 60) || `Hoja de vida ${i + 1}`, text: block }));
}

/** CSV (separated by ";" so Excel in Spanish opens it in columns) with the best results. */
export function resultsToCsv(results: ResumeResult[]): string {
  const header = ['Posición', 'Nombre', 'Puntaje', 'Clasificación', 'Años de experiencia', 'Coinciden', 'Inferidas', 'Faltan'];
  const labels: Record<string, string> = { high: 'Alto', medium: 'Medio', low: 'Bajo' };
  return toCsv(
    header,
    results.map((r, i) => [i + 1, r.name, r.score, labels[r.classification], r.years, r.matched.join(', '), r.inferred.join(', '), r.missing.join(', ')]),
  );
}

type Source = 'synthetic' | 'system' | 'pasted';

/** Measured during a run: how long the screen stopped repainting. */
export interface RunWithFreeze extends AnalysisRun {
  /** Longest gap between two frames, in ms (more than ~100 ms is a visible freeze) */
  maxFrameGapMs: number;
  /** Frames that took longer than 50 ms */
  longFrames: number;
}

@Component({
  selector: 'app-bulk-analysis',
  imports: [DecimalPipe, Icon, LabelPipe, YearsPipe],
  templateUrl: './bulk-analysis.html',
  styleUrl: './bulk-analysis.css',
})
export class BulkAnalysis implements OnInit {
  private readonly jobsApi = inject(JobService);
  private readonly candidatesApi = inject(CandidateService);
  private readonly toasts = inject(ToastService);
  protected readonly analysis = inject(CvAnalysisService);

  protected readonly i = { Activity, CircleCheck, Download, Info, Layers, TriangleAlert, Trophy, Zap };
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly tone = scoreTone;
  protected readonly initials = initials;
  protected readonly presets = [1000, 5000, 10000, 25000, 50000];
  protected readonly weights = [
    { label: 'Habilidades técnicas', pct: 50 },
    { label: 'Similitud del perfil (TF-IDF)', pct: 20 },
    { label: 'Experiencia previa', pct: 20 },
    { label: 'Educación', pct: 10 },
  ];

  protected readonly jobs = signal<Job[]>([]);
  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly jobId = signal<number | null>(null);
  protected readonly source = signal<Source>('synthetic');
  protected readonly includeSystem = signal(true);
  protected readonly syntheticCount = signal(10000);
  protected readonly pasted = signal('');
  protected readonly runs = signal<RunWithFreeze[]>([]);
  protected readonly latest = computed(() => this.runs()[0] ?? null);
  protected readonly elapsed = signal(0);

  // ---- Frame monitor: everything here runs on the main thread, so it shows when it is blocked ----
  protected readonly fps = signal(60);
  protected readonly frameTimes = signal<number[]>([]);
  private gapDuringRun = { max: 0, long: 0 };
  /** Time window of the current run; a frame counts if its interval overlaps it. */
  private runWindow: { start: number; end: number | null } | null = null;

  protected readonly fluid = computed(() => this.fps() >= 45);
  /** Polyline of the last frame times for the little chart (higher = slower frame). */
  protected readonly sparkline = computed(() => {
    const times = this.frameTimes();
    return times
      .map((t, n) => `${(n / Math.max(1, times.length - 1)) * 120},${30 - Math.min(28, (t / 100) * 28)}`)
      .join(' ');
  });

  protected readonly selectedJob = computed(() => this.jobs().find((j) => j.id === this.jobId()) ?? null);
  protected readonly pastedResumes = computed(() => parsePastedResumes(this.pasted()));
  protected readonly totalToAnalyze = computed(
    () => (this.includeSystem() ? this.candidates().length : 0) + this.pastedResumes().length + this.syntheticCount(),
  );
  protected readonly speed = computed(() => {
    const run = this.latest();
    return run && run.wallMs ? Math.round((run.output.total / run.wallMs) * 1000) : 0;
  });
  /** Wall time of the worker and main-thread runs, to compare them. */
  protected readonly comparison = computed(() => {
    const worker = this.runs().find((r) => r.mode === 'worker');
    const main = this.runs().find((r) => r.mode === 'main');
    return worker && main && worker.output.total === main.output.total ? { worker, main } : null;
  });

  constructor() {
    let handle = 0;
    let last = typeof performance !== 'undefined' ? performance.now() : 0;
    let frames = 0;
    let windowStart = last;
    const tick = (now: number) => {
      const gap = now - last;
      last = now;
      frames++;
      // A blocked main thread paints nothing, so the long frame arrives right after the run ends:
      // it counts when its interval overlaps the run window
      const run = this.runWindow;
      if (run && now - gap < (run.end ?? Infinity) && now > run.start) {
        this.gapDuringRun.max = Math.max(this.gapDuringRun.max, gap);
        if (gap > 50) this.gapDuringRun.long++;
      }
      this.frameTimes.update((list) => [...list.slice(-59), gap]);
      if (now - windowStart >= 500) {
        this.fps.set(Math.round((frames * 1000) / (now - windowStart)));
        frames = 0;
        windowStart = now;
      }
      handle = requestAnimationFrame(tick);
    };
    if (typeof requestAnimationFrame !== 'undefined') handle = requestAnimationFrame(tick);
    inject(DestroyRef).onDestroy(() => {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(handle);
      this.analysis.cancel();
    });
  }

  ngOnInit(): void {
    forkJoin({ jobs: this.jobsApi.list(), candidates: this.candidatesApi.list() }).subscribe({
      next: ({ jobs, candidates }) => {
        this.jobs.set(jobs);
        this.candidates.set(candidates);
        this.jobId.set(jobs.find((j) => j.status === 'open')?.id ?? jobs[0]?.id ?? null);
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected buildJob(): AnalysisJob | null {
    const job = this.selectedJob();
    if (!job) return null;
    const system = this.includeSystem()
      ? this.candidates().map((c) => ({ name: c.name, text: `${c.resume_text} ${c.skills.join(', ')}` }))
      : [];
    return {
      job: {
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        requiredSkills: job.required_skills,
        minYears: job.min_experience_years,
        minEducation: job.min_education_level as EducationKey | null,
      },
      resumes: [...system, ...this.pastedResumes()],
      syntheticCount: this.syntheticCount(),
    };
  }

  protected async run(mode: AnalysisMode): Promise<void> {
    const job = this.buildJob();
    if (!job) {
      this.toasts.info('Primero crea o elige una vacante');
      return;
    }
    this.gapDuringRun = { max: 0, long: 0 };
    this.runWindow = { start: performance.now(), end: null };
    try {
      const result = await this.analysis.run(job, mode);
      this.runWindow.end = performance.now();
      // Wait for the next painted frames, which carry the gap of a blocked thread
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const measured: RunWithFreeze = { ...result, maxFrameGapMs: Math.round(this.gapDuringRun.max), longFrames: this.gapDuringRun.long };
      this.runs.update((list) => [measured, ...list].slice(0, 6));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.runWindow = null;
    }
  }

  protected exportCsv(): void {
    const run = this.latest();
    if (!run) return;
    downloadCsv(csvFileName('analisis', this.selectedJob()?.title ?? 'vacante'), resultsToCsv(run.output.top));
  }

}
