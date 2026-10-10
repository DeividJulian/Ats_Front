import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Application, Candidate, CandidateInsights, Job, JobRecommendation } from '../../../core/models';
import { ApplicationService, CandidateService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { InsightsCard } from '../../../shared/insights-card';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { PdfDrop } from '../../../shared/pdf-drop';
import { ScoreBar } from '../../../shared/score-bar';
import { CandidateForm } from '../candidates/candidate-form';

@Component({
  selector: 'app-candidate-detail',
  imports: [RouterLink, DatePipe, LabelPipe, ScoreBar, Modal, PdfDrop, CandidateForm, InsightsCard],
  templateUrl: './candidate-detail.html',
  styles: `
    .profile { display: flex; gap: 18px; align-items: center; }
    .avatar { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 22px; background: linear-gradient(135deg, var(--violet), var(--blue)); color: #fff; flex: none; }
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    .col { display: grid; gap: 18px; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class CandidateDetail {
  /** Route parameter (/app/candidatos/:id) */
  readonly id = input.required<string>();

  private readonly api = inject(CandidateService);
  private readonly applicationsApi = inject(ApplicationService);
  private readonly jobsApi = inject(JobService);
  private readonly toasts = inject(ToastService);

  protected readonly candidate = signal<Candidate | null>(null);
  protected readonly insights = signal<CandidateInsights | null>(null);
  protected readonly recommended = signal<JobRecommendation[]>([]);
  protected readonly applications = signal<Application[]>([]);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly uploading = signal(false);
  protected readonly showResume = signal(false);

  protected readonly initials = computed(() => initials(this.candidate()?.name));
  protected readonly jobTitles = computed(() => new Map(this.jobs().map((j) => [j.id, j.title])));

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    const id = Number(this.id());
    forkJoin({
      candidate: this.api.get(id),
      insights: this.api.insights(id),
      recommended: this.api.recommendedJobs(id, 5),
      applications: this.applicationsApi.list({ candidate_id: id }),
      jobs: this.jobsApi.list(),
    }).subscribe({
      next: (r) => {
        this.candidate.set(r.candidate);
        this.insights.set(r.insights);
        this.recommended.set(r.recommended);
        this.applications.set(r.applications);
        this.jobs.set(r.jobs);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected saved(c: Candidate): void {
    this.candidate.set(c);
    this.editing.set(false);
    this.load();
  }

  protected upload(file: File): void {
    this.uploading.set(true);
    this.api.uploadResume(Number(this.id()), file).subscribe({
      next: (c) => {
        this.uploading.set(false);
        this.toasts.ok(`Hoja de vida leída: ${c.skills.length} habilidades en el perfil`);
        this.load();
      },
      error: (e) => {
        this.uploading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected apply(job: JobRecommendation): void {
    this.applicationsApi.apply(job.job_id, Number(this.id())).subscribe({
      next: (a) => {
        this.toasts.ok(`Postulado a ${job.title} con ${a.score} puntos`);
        this.load();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }
}
