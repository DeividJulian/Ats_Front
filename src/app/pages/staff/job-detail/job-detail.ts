import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Briefcase, ChevronRight, Clock, ExternalLink, GraduationCap, Lock, Pencil, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-angular';

import { Job } from '../../../core/models';
import { JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage } from '../../../core/utils/http-error';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { AgoPipe } from '../../../shared/ago.pipe';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { RankingBoard } from '../ranking-board/ranking-board';
import { YearsPipe } from '../../../shared/years.pipe';

/** Readable job code, as VAC-0012. */
export function jobCode(id: number): string {
  return `VAC-${String(id).padStart(4, '0')}`;
}

@Component({
  selector: 'app-job-detail',
  imports: [RouterLink, LabelPipe, AgoPipe, Icon, RankingBoard, YearsPipe],
  templateUrl: './job-detail.html',
  styles: `
    .about summary { cursor: pointer; }
    .about-body { margin-top: 14px; }
    .about .pre { max-height: none; color: var(--c-text); }
  `,
})
export class JobDetail {
  /** Route parameter (/app/vacantes/:id) */
  readonly id = input.required<string>();

  private readonly jobsApi = inject(JobService);
  private readonly toasts = inject(ToastService);
  private readonly board = viewChild(RankingBoard);

  protected readonly i = { Briefcase, ChevronRight, Clock, ExternalLink, GraduationCap, Lock, Pencil, RefreshCw, RotateCcw, TriangleAlert };
  protected readonly job = signal<Job | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly recalculating = signal(false);
  protected readonly code = computed(() => jobCode(Number(this.id())));
  protected readonly area = computed(() => areaOf(this.job()?.required_skills ?? []));

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    this.jobsApi.get(Number(this.id())).subscribe({
      next: (job) => {
        this.job.set(job);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected recalculate(): void {
    this.recalculating.set(true);
    this.jobsApi.recalculateRanking(Number(this.id())).subscribe({
      next: (r) => {
        this.recalculating.set(false);
        this.toasts.ok(`Ranking recalculado (${r.updated_applications} postulaciones)`);
        this.board()?.load();
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
