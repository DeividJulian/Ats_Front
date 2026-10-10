import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApplicationStatus, Job, RankingItem, Suggestion } from '../../../core/models';
import { ApplicationService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { NEXT_STATUSES, statusLabel } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { ScoreBar } from '../../../shared/score-bar';
import { ApplicationReview } from './application-review';

type Tab = 'ranking' | 'suggested' | 'details';

@Component({
  selector: 'app-job-detail',
  imports: [RouterLink, LabelPipe, ScoreBar, Modal, ApplicationReview],
  templateUrl: './job-detail.html',
  styles: `
    .head-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .pos { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-weight: 800; background: var(--surface-2); color: var(--accent); }
    .pos.first { background: var(--accent); color: var(--accent-ink); }
    .who { display: grid; gap: 2px; }
    .status-select { width: auto; padding: 6px 10px; font-size: 13px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  `,
})
export class JobDetail {
  /** Route parameter (/app/vacantes/:id) */
  readonly id = input.required<string>();

  private readonly jobsApi = inject(JobService);
  private readonly applications = inject(ApplicationService);
  private readonly toasts = inject(ToastService);

  protected readonly job = signal<Job | null>(null);
  protected readonly ranking = signal<RankingItem[]>([]);
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<Tab>('ranking');
  protected readonly blind = signal(false);
  protected readonly recalculating = signal(false);
  protected readonly reviewing = signal<RankingItem | null>(null);

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    const id = Number(this.id());
    this.jobsApi.get(id).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
    this.loadRanking();
    this.jobsApi.suggestedCandidates(id, 10).subscribe({ next: (s) => this.suggestions.set(s), error: () => this.suggestions.set([]) });
  }

  protected loadRanking(): void {
    this.jobsApi.ranking(Number(this.id()), this.blind()).subscribe({
      next: (r) => this.ranking.set(r),
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected toggleBlind(): void {
    this.blind.update((b) => !b);
    this.loadRanking();
  }

  protected nextStatuses(status: ApplicationStatus): ApplicationStatus[] {
    return NEXT_STATUSES[status];
  }

  protected changeStatus(item: RankingItem, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as ApplicationStatus;
    select.value = '';
    if (!status) return;
    this.applications.setStatus(item.application_id, status).subscribe({
      next: () => {
        this.toasts.ok(`${this.blind() ? 'Candidato' : item.name}: ${statusLabel(status)}`);
        this.loadRanking();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected withdraw(item: RankingItem): void {
    if (!confirm('¿Retirar esta postulación de la vacante?')) return;
    this.applications.withdraw(item.application_id).subscribe({
      next: () => {
        this.toasts.ok('Postulación retirada');
        this.load();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected applySuggested(s: Suggestion): void {
    this.applications.apply(Number(this.id()), s.candidate_id).subscribe({
      next: (a) => {
        this.toasts.ok(`${s.name} quedó postulado con ${a.score} puntos`);
        this.load();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected recalculate(): void {
    this.recalculating.set(true);
    this.jobsApi.recalculateRanking(Number(this.id())).subscribe({
      next: (r) => {
        this.recalculating.set(false);
        this.toasts.ok(`Ranking recalculado (${r.updated_applications} postulaciones)`);
        this.loadRanking();
      },
      error: (e) => {
        this.recalculating.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected toggleStatus(job: Job): void {
    this.jobsApi.setStatus(job.id, job.status === 'open' ? 'closed' : 'open').subscribe({
      next: (updated) => {
        this.job.set(updated);
        this.toasts.ok(updated.status === 'open' ? 'Vacante reabierta' : 'Vacante cerrada');
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }
}
