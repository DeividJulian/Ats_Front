import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { Candidate, Job } from '../../../core/models';
import { CandidateService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { AnalysisJob, EducationKey, ResumeInput } from '../../../core/workers/cv-analysis.logic';
import { AnalysisMode, AnalysisRun, CvAnalysisService } from '../../../core/workers/cv-analysis.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { ScoreBar } from '../../../shared/score-bar';

/** Splits pasted text into resumes: one per block separated by a line with "---". */
export function parsePastedResumes(text: string): ResumeInput[] {
  return text
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block, i) => ({ name: block.split('\n')[0].slice(0, 60) || `Hoja de vida ${i + 1}`, text: block }));
}

@Component({
  selector: 'app-bulk-analysis',
  imports: [DecimalPipe, LabelPipe, ScoreBar],
  templateUrl: './bulk-analysis.html',
  styleUrl: './bulk-analysis.css',
})
export class BulkAnalysis implements OnInit {
  private readonly jobsApi = inject(JobService);
  private readonly candidatesApi = inject(CandidateService);
  private readonly toasts = inject(ToastService);
  protected readonly analysis = inject(CvAnalysisService);

  protected readonly jobs = signal<Job[]>([]);
  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly jobId = signal<number | null>(null);
  protected readonly includeSystem = signal(true);
  protected readonly syntheticCount = signal(5000);
  protected readonly pasted = signal('');
  protected readonly runs = signal<AnalysisRun[]>([]);
  protected readonly latest = computed(() => this.runs()[0] ?? null);

  /** Animation driven by JavaScript: if the main thread is blocked, it visibly freezes. */
  protected readonly frames = signal(0);
  protected readonly ballOffset = computed(() => Math.abs(((this.frames() * 2) % 400) - 200));

  protected readonly selectedJob = computed(() => this.jobs().find((j) => j.id === this.jobId()) ?? null);
  protected readonly pastedResumes = computed(() => parsePastedResumes(this.pasted()));
  protected readonly totalToAnalyze = computed(
    () => (this.includeSystem() ? this.candidates().length : 0) + this.pastedResumes().length + this.syntheticCount(),
  );

  constructor() {
    let handle = 0;
    const tick = () => {
      this.frames.update((f) => f + 1);
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
    try {
      const result = await this.analysis.run(job, mode);
      this.runs.update((list) => [result, ...list].slice(0, 6));
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
