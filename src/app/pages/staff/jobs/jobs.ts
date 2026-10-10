import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Job, JobStatus } from '../../../core/models';
import { JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';

type Filter = 'all' | JobStatus;

@Component({
  selector: 'app-jobs',
  imports: [RouterLink, DatePipe, LabelPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Vacantes</div>
          <h1>Tus vacantes</h1>
          <p class="subtle">Abre una vacante para ver el ranking de candidatos.</p>
        </div>
        <a class="btn primary" routerLink="/app/vacantes/nueva">+ Nueva vacante</a>
      </div>

      <div class="row">
        <div class="tabs">
          @for (f of filters; track f.value) {
            <button type="button" [class.active]="filter() === f.value" (click)="filter.set(f.value)">
              {{ f.label }} <span class="subtle">({{ count(f.value) }})</span>
            </button>
          }
        </div>
        <span class="spacer"></span>
        <input type="search" class="search" placeholder="Buscar vacante…" aria-label="Buscar vacante" (input)="search.set($any($event.target).value)" />
      </div>

      @if (loading()) {
        <div class="card stack"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
      } @else if (error()) {
        <div class="empty"><strong>{{ error() }}</strong><button type="button" class="btn small" (click)="load()">Reintentar</button></div>
      } @else if (visible().length === 0) {
        <div class="empty">
          <span class="big">💼</span>
          <strong>{{ jobs().length ? 'Ninguna vacante coincide' : 'Todavía no tienes vacantes' }}</strong>
          @if (!jobs().length) { <a class="btn primary small" routerLink="/app/vacantes/nueva">Crear la primera</a> }
        </div>
      } @else {
        <div class="list">
          @for (job of visible(); track job.id) {
            <div class="card job">
              <div class="main">
                <div class="row">
                  <a class="title" [routerLink]="['/app/vacantes', job.id]">{{ job.title }}</a>
                  <span class="badge" [class]="job.status">{{ job.status | label: 'jobStatus' }}</span>
                </div>
                <div class="chips">
                  @for (skill of job.required_skills; track skill) { <span class="chip">{{ skill }}</span> }
                </div>
                <span class="subtle small">
                  {{ job.min_experience_years }} años de experiencia · {{ job.min_education_level | label: 'education' }} · creada el {{ job.created_at | date: 'd MMM y' }}
                </span>
              </div>
              <div class="actions">
                <a class="btn small primary" [routerLink]="['/app/vacantes', job.id]">Ver ranking</a>
                <a class="btn small" [routerLink]="['/app/vacantes', job.id, 'editar']">Editar</a>
                <button type="button" class="btn small" (click)="toggle(job)">{{ job.status === 'open' ? 'Cerrar' : 'Reabrir' }}</button>
                <button type="button" class="btn small danger" (click)="remove(job)">Eliminar</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .search { max-width: 280px; }
    .list { display: grid; gap: 12px; }
    .job { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
    .main { flex: 1; min-width: 260px; display: grid; gap: 10px; }
    .title { font-size: 17px; font-weight: 700; color: var(--text); }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  `,
})
export class Jobs {
  private readonly api = inject(JobService);
  private readonly toasts = inject(ToastService);

  protected readonly jobs = signal<Job[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('all');
  protected readonly search = signal('');
  protected readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: 'Abiertas' },
    { value: 'closed', label: 'Cerradas' },
  ];

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

  protected count(filter: Filter): number {
    return filter === 'all' ? this.jobs().length : this.jobs().filter((j) => j.status === filter).length;
  }

  protected load(): void {
    this.api.list().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
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
