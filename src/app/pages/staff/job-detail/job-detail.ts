import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowLeft, ExternalLink, GraduationCap, Lock, Pencil, RefreshCw, RotateCcw, Timer } from 'lucide-angular';

import { Job } from '../../../core/models';
import { JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage } from '../../../core/utils/http-error';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { RankingBoard } from '../ranking-board/ranking-board';

/** Readable job code, as VAC-0012. */
export function jobCode(id: number): string {
  return `VAC-${String(id).padStart(4, '0')}`;
}

@Component({
  selector: 'app-job-detail',
  imports: [RouterLink, LabelPipe, Icon, RankingBoard],
  template: `
    <div class="page narrow">
      @if (loading()) {
        <div class="card stack"><div class="skeleton" style="width: 40%"></div><div class="skeleton"></div></div>
      } @else if (error()) {
        <div class="empty"><strong>{{ error() }}</strong><a class="btn small" routerLink="/app/vacantes">Volver a vacantes</a></div>
      } @else if (job(); as job) {
        <a routerLink="/app/vacantes" class="back small"><app-icon [icon]="i.ArrowLeft" [size]="15" /> Vacantes</a>

        <div class="stack head">
          <div class="row">
            <span class="badge dot" [class]="job.status === 'open' ? 'high' : 'closed'">{{ job.status | label: 'jobStatus' }}</span>
            <span class="badge">ID: {{ code() }}</span>
            <span class="badge peach">{{ area() | label: 'area' }}</span>
          </div>
          <h1>{{ job.title }}</h1>
          <div class="row small subtle">
            <span class="meta"><app-icon [icon]="i.GraduationCap" [size]="15" /> {{ job.min_education_level | label: 'education' }}</span>
            <span class="meta"><app-icon [icon]="i.Timer" [size]="15" /> {{ job.min_experience_years }} años de experiencia</span>
          </div>
          <div class="chips">@for (s of job.required_skills; track s) { <span class="chip outline">{{ s }}</span> }</div>

          <button type="button" class="btn primary large block" [disabled]="recalculating()" (click)="recalculate()">
            <app-icon [icon]="i.RefreshCw" [size]="18" /> {{ recalculating() ? 'Recalculando…' : 'Recalcular ranking' }}
          </button>
          <div class="row">
            <a class="btn small soft" [routerLink]="['/app/vacantes', job.id, 'editar']"><app-icon [icon]="i.Pencil" [size]="15" /> Editar</a>
            <button type="button" class="btn small outline" (click)="toggleStatus(job)">
              <app-icon [icon]="job.status === 'open' ? i.Lock : i.RotateCcw" [size]="15" /> {{ job.status === 'open' ? 'Cerrar vacante' : 'Reabrir' }}
            </button>
            @if (job.status === 'open') {
              <a class="btn small ghost" [routerLink]="['/empleos', job.id]" target="_blank"><app-icon [icon]="i.ExternalLink" [size]="15" /> Ver como candidato</a>
            }
          </div>
        </div>

        <app-ranking-board [job]="job" />

        <details class="card">
          <summary><strong>Descripción completa de la vacante</strong></summary>
          <div class="stack" style="margin-top: 12px">
            <p class="pre">{{ job.description }}</p>
            @if (job.requirements) { <h3>Requisitos</h3><p class="pre">{{ job.requirements }}</p> }
          </div>
        </details>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 860px; }
    .back { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
    .head h1 { font-size: clamp(26px, 4vw, 34px); }
    .meta { display: inline-flex; align-items: center; gap: 5px; }
    summary { cursor: pointer; }
  `,
})
export class JobDetail {
  /** Route parameter (/app/vacantes/:id) */
  readonly id = input.required<string>();

  private readonly jobsApi = inject(JobService);
  private readonly toasts = inject(ToastService);
  private readonly board = viewChild(RankingBoard);

  protected readonly i = { ArrowLeft, ExternalLink, GraduationCap, Lock, Pencil, RefreshCw, RotateCcw, Timer };
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
