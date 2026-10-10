import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { JobRecommendation, MyApplication, PublicJob } from '../../../core/models';
import { PortalService, PublicService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { ScoreBar } from '../../../shared/score-bar';

export interface JobWithFit {
  job: PublicJob;
  fit: JobRecommendation | null;
  application: MyApplication | null;
}

/** Joins the open jobs with the candidate's own fit and applications; best fit first. */
export function jobsWithFit(jobs: PublicJob[], fits: JobRecommendation[], applications: MyApplication[]): JobWithFit[] {
  const fitById = new Map(fits.map((f) => [f.job_id, f]));
  const applicationById = new Map(applications.map((a) => [a.job_id, a]));
  return jobs
    .map((job) => ({ job, fit: fitById.get(job.id) ?? null, application: applicationById.get(job.id) ?? null }))
    .sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1));
}

@Component({
  selector: 'app-portal-jobs',
  imports: [RouterLink, LabelPipe, ScoreBar],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Vacantes</div>
          <h1>Vacantes abiertas</h1>
          <p class="subtle">Ordenadas según qué tan bien encajan con tu perfil.</p>
        </div>
        <input type="search" class="search" placeholder="Buscar por cargo o habilidad…" aria-label="Buscar vacante" (input)="search.set($any($event.target).value)" />
      </div>

      @if (loading()) {
        <div class="card stack"><div class="skeleton"></div><div class="skeleton"></div></div>
      } @else if (error()) {
        <div class="empty"><strong>{{ error() }}</strong><button type="button" class="btn small" (click)="load()">Reintentar</button></div>
      } @else if (visible().length === 0) {
        <div class="empty"><span class="big">🔍</span><strong>No hay vacantes que coincidan</strong></div>
      } @else {
        <div class="grid cols-2">
          @for (item of visible(); track item.job.id) {
            <div class="card stack">
              <div class="row">
                <a [routerLink]="['/empleos', item.job.id]"><h3>{{ item.job.title }}</h3></a>
                <span class="spacer"></span>
                @if (item.application) {
                  <span class="badge" [class]="item.application.status">Postulado · {{ item.application.status | label: 'status' }}</span>
                }
              </div>
              <p class="subtle small clamp">{{ item.job.description }}</p>
              @if (item.fit; as fit) {
                <div class="stack" style="gap: 6px">
                  <span class="small subtle">Tu ajuste</span>
                  <app-score-bar [score]="fit.score" [classification]="fit.classification" />
                </div>
                <div class="chips">
                  @for (s of fit.matching_skills; track s) { <span class="chip good">✓ {{ s }}</span> }
                  @for (s of fit.missing_skills; track s) { <span class="chip bad">✗ {{ s }}</span> }
                </div>
              } @else {
                <div class="chips">@for (s of item.job.required_skills; track s) { <span class="chip">{{ s }}</span> }</div>
              }
              <div class="row">
                <a class="btn small" [routerLink]="['/empleos', item.job.id]">Ver detalle</a>
                @if (!item.application) {
                  <button type="button" class="btn small primary" [disabled]="applying() === item.job.id" (click)="apply(item.job)">Postularme</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .search { max-width: 300px; }
    h3 { color: var(--text); }
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  `,
})
export class PortalJobs {
  private readonly portal = inject(PortalService);
  private readonly publicApi = inject(PublicService);
  private readonly toasts = inject(ToastService);

  protected readonly items = signal<JobWithFit[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly applying = signal<number | null>(null);

  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    if (!term) return this.items();
    return this.items().filter((i) => normalize(`${i.job.title} ${i.job.required_skills.join(' ')}`).includes(term));
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    forkJoin({
      jobs: this.publicApi.jobs(),
      fits: this.portal.recommendedJobs(50),
      applications: this.portal.applications(),
    }).subscribe({
      next: ({ jobs, fits, applications }) => {
        this.items.set(jobsWithFit(jobs, fits, applications));
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected apply(job: PublicJob): void {
    this.applying.set(job.id);
    this.portal.apply(job.id).subscribe({
      next: () => {
        this.applying.set(null);
        this.toasts.ok(`¡Te postulaste a ${job.title}!`);
        this.load();
      },
      error: (e) => {
        this.applying.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
