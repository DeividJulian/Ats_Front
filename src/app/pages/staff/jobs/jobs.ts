import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Briefcase, CloudOff, Files, GraduationCap, LayoutGrid, List, Lock, Plus, RotateCcw, Search, Trash2 } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { Job, JobStatus, Stats } from '../../../core/models';
import { JobService, StatsService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage } from '../../../core/utils/http-error';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { AgoPipe } from '../../../shared/ago.pipe';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';

type Filter = 'all' | JobStatus;

@Component({
  selector: 'app-jobs',
  imports: [RouterLink, LabelPipe, AgoPipe, Icon],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  private readonly api = inject(JobService);
  private readonly statsApi = inject(StatsService);
  private readonly toasts = inject(ToastService);

  protected readonly i = { Briefcase, CloudOff, Files, GraduationCap, LayoutGrid, List, Lock, Plus, RotateCcw, Search, Trash2 };

  protected readonly jobs = signal<Job[]>([]);
  protected readonly stats = signal<Stats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('all');
  protected readonly search = signal('');
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abiertas' },
    { value: 'closed', label: 'Cerradas' },
  ];
  protected readonly view = signal<'cards' | 'table'>('cards');
  protected readonly areaOf = areaOf;

  protected readonly applicationsById = computed(
    () => new Map((this.stats()?.per_job ?? []).map((p) => [p.job_id, p] as const)),
  );

  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    return this.jobs().filter(
      (job) =>
        (this.filter() === 'all' || job.status === this.filter()) &&
        (!term || normalize(`${job.title} ${job.required_skills.join(' ')}`).includes(term)),
    );
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected statsFor(jobId: number) {
    return this.applicationsById().get(jobId);
  }

  protected count(filter: Filter): number {
    return filter === 'all' ? this.jobs().length : this.jobs().filter((j) => j.status === filter).length;
  }

  protected load(): void {
    forkJoin({ jobs: this.api.list(), stats: this.statsApi.get() }).subscribe({
      next: ({ jobs, stats }) => {
        this.jobs.set(jobs);
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected toggle(job: Job): void {
    const status: JobStatus = job.status === 'open' ? 'closed' : 'open';
    this.api.setStatus(job.id, status).subscribe({
      next: (updated) => {
        this.jobs.update((list) => list.map((j) => (j.id === updated.id ? updated : j)));
        this.toasts.ok(status === 'open' ? 'Vacante reabierta' : 'Vacante cerrada: ya no recibe postulaciones');
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected remove(job: Job): void {
    if (!confirm(`¿Eliminar "${job.title}"? También se borrarán sus postulaciones. Esta acción no se puede deshacer.`)) return;
    this.api.remove(job.id).subscribe({
      next: (r) => {
        this.jobs.update((list) => list.filter((j) => j.id !== job.id));
        this.toasts.ok(`Vacante eliminada (${r.deleted_applications} postulaciones borradas)`);
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }
}
