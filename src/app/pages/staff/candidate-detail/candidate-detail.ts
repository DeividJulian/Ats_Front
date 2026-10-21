import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight, Clock, CloudUpload, FileText, Mail, Pencil, Phone, Plus, TriangleAlert } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { Application, Candidate, CandidateInsights, Job, JobRecommendation } from '../../../core/models';
import { ApplicationService, CandidateService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { statusBadge } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { AgoPipe } from '../../../shared/ago.pipe';
import { Icon } from '../../../shared/icon';
import { InsightsCard } from '../../../shared/insights-card';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { PdfDrop } from '../../../shared/pdf-drop';
import { scoreTone } from '../../../shared/score-bar';
import { CandidateForm } from '../candidates/candidate-form';
import { YearsPipe } from '../../../shared/years.pipe';

@Component({
  selector: 'app-candidate-detail',
  imports: [RouterLink, LabelPipe, AgoPipe, Icon, Modal, PdfDrop, CandidateForm, InsightsCard, YearsPipe],
  templateUrl: './candidate-detail.html',
  styles: `
    .head-text { flex: 1 1 320px; min-width: 0; }
    .plain-link { text-decoration: none; color: inherit; }
    .plain-link:hover .list__title { color: var(--c-primary); }
    .plain-link .list__main { display: flex; flex-direction: column; align-items: flex-start; }
    .title-link { color: var(--c-text); display: block; }
    .title-link:hover { color: var(--c-primary); }
    .resume { max-height: 420px; color: var(--c-text); }
  `,
})
export class CandidateDetail {
  /** Route parameter (/app/candidatos/:id) */
  readonly id = input.required<string>();

  private readonly api = inject(CandidateService);
  private readonly applicationsApi = inject(ApplicationService);
  private readonly jobsApi = inject(JobService);
  private readonly toasts = inject(ToastService);

  protected readonly i = { ChevronRight, Clock, CloudUpload, FileText, Mail, Pencil, Phone, Plus, TriangleAlert };
  protected readonly statusBadge = statusBadge;
  protected readonly tone = scoreTone;
  protected readonly pdfOpen = signal(false);
  protected readonly applying = signal<number | null>(null);
  protected readonly candidate = signal<Candidate | null>(null);
  protected readonly insights = signal<CandidateInsights | null>(null);
  protected readonly recommended = signal<JobRecommendation[]>([]);
  protected readonly applications = signal<Application[]>([]);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
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
    this.uploadError.set(null);
    this.api.uploadResume(Number(this.id()), file).subscribe({
      next: (c) => {
        this.uploading.set(false);
        this.pdfOpen.set(false);
        this.toasts.ok(`Hoja de vida leída: ${c.skills.length} habilidades en el perfil`);
        this.load();
      },
      error: (e) => {
        this.uploading.set(false);
        this.uploadError.set(errorMessage(e));
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected apply(job: JobRecommendation): void {
    this.applying.set(job.job_id);
    this.applicationsApi.apply(job.job_id, Number(this.id())).subscribe({
      next: (a) => {
        this.applying.set(null);
        this.toasts.ok(`Postulado a ${job.title} con ${a.score} puntos`);
        this.load();
      },
      error: (e) => {
        this.applying.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
