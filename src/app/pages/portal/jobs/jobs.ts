import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Briefcase, CircleCheck, CircleX, Clock, CloudOff, GraduationCap, Search, SearchX } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { Area, JobRecommendation, MyApplication, PublicJob } from '../../../core/models';
import { PortalService, PublicService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { AREA_LABELS, statusBadge } from '../../../core/utils/labels';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { AgoPipe } from '../../../shared/ago.pipe';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';
import { YearsPipe } from '../../../shared/years.pipe';

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

type AreaFilter = 'all' | Area;

@Component({
  selector: 'app-portal-jobs',
  imports: [RouterLink, LabelPipe, AgoPipe, Icon, YearsPipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div class="page-head__text">
          <h1 class="t-h1">Vacantes</h1>
          <p class="t-muted">Empleos abiertos, ordenados según qué tan bien encajan con tu perfil.</p>
        </div>
      </div>

      <div class="card card--tight toolbar">
        <span class="control control--icon">
          <app-icon [icon]="i.Search" [size]="20" />
          <input class="input" type="search" aria-label="Buscar vacantes" placeholder="Cargo o habilidad (ej. Siigo)" [value]="search()" (input)="search.set($any($event.target).value)" />
        </span>
        <span class="control sort">
          <select class="select" aria-label="Ordenar" [value]="sort()" (change)="sort.set($any($event.target).value)">
            <option value="fit">Mejor ajuste primero</option>
            <option value="recent">Más recientes primero</option>
          </select>
        </span>
      </div>

      @if (areaFilters().length > 2) {
        <div class="chips" role="group" aria-label="Área profesional">
          @for (a of areaFilters(); track a.value) {
            <button type="button" class="filter" [class.is-active]="area() === a.value" [attr.aria-pressed]="area() === a.value" (click)="area.set(a.value)">
              {{ a.label }} <span class="count">{{ a.count }}</span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="grid-2">@for (n of [1, 2, 3, 4]; track n) { <div class="card stack"><span class="skeleton sk-title"></span><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span></div> }</div>
      } @else if (error()) {
        <div class="card empty">
          <span class="empty__icon empty__icon--danger"><app-icon [icon]="i.CloudOff" [size]="32" /></span>
          <p class="empty__title">No pudimos cargar las vacantes</p>
          <p class="empty__text">{{ error() }}</p>
          <button type="button" class="btn btn--secondary" (click)="load()">Reintentar</button>
        </div>
      } @else if (visible().length === 0) {
        <div class="card empty">
          <span class="empty__icon"><app-icon [icon]="i.SearchX" [size]="32" /></span>
          <p class="empty__title">No encontramos vacantes con esos filtros</p>
          <p class="empty__text">Prueba con otra palabra o cambia el área.</p>
          <button type="button" class="btn btn--secondary" (click)="clear()">Limpiar filtros</button>
        </div>
      } @else {
        <p class="t-small t-muted" aria-live="polite"><span class="t-strong count-text">{{ visible().length }}</span> vacantes encontradas</p>
        <div class="grid-2">
          @for (item of visible(); track item.job.id) {
            <article class="card stack stack--sm">
              <div class="row row--nowrap row--top">
                <span class="avatar">{{ initials(item.job.title) }}</span>
                <div class="list__main">
                  <h2 class="t-h3">{{ item.job.title }}</h2>
                  <p class="t-small t-muted">{{ areaLabel(item.job.required_skills) }}</p>
                </div>
                @if (item.application) {
                  <span [class]="statusBadge(item.application.status)">{{ item.application.status | label: 'status' }}</span>
                } @else if (item.fit; as fit) {
                  <span class="score-pill" [class]="'score-pill--' + tone(fit.classification)" [title]="'Tu ajuste: ' + fit.score + ' de 100'">{{ fit.score }}</span>
                }
              </div>
              <div class="meta">
                <span><app-icon [icon]="i.Briefcase" [size]="16" />{{ item.job.min_experience_years ? (item.job.min_experience_years | years) : 'Sin experiencia mínima' }}</span>
                <span><app-icon [icon]="i.GraduationCap" [size]="16" />{{ item.job.min_education_level | label: 'education' }}</span>
                <span><app-icon [icon]="i.Clock" [size]="16" />{{ item.job.created_at | ago }}</span>
              </div>
              @if (item.fit; as fit) {
                <div class="chips">
                  @for (s of fit.matching_skills; track s) { <span class="chip chip--match"><app-icon [icon]="i.CircleCheck" [size]="15" />{{ s }}</span> }
                  @for (s of fit.missing_skills; track s) { <span class="chip chip--miss"><app-icon [icon]="i.CircleX" [size]="15" />{{ s }}</span> }
                </div>
              } @else {
                <div class="chips">@for (s of item.job.required_skills; track s) { <span class="chip">{{ s }}</span> }</div>
              }
              <div class="card__foot">
                <a class="btn btn--secondary btn--sm" [routerLink]="['/empleos', item.job.id]">Ver detalle</a>
                <span class="spacer"></span>
                @if (!item.application) {
                  <button type="button" class="btn btn--primary btn--sm" [class.is-loading]="applying() === item.job.id" [disabled]="applying() === item.job.id" (click)="apply(item.job)">
                    @if (applying() === item.job.id) { <span class="spinner"></span>Enviando… } @else { Postularme }
                  </button>
                } @else {
                  <span class="t-small t-muted">Ya te postulaste</span>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .sort { flex: 0 1 240px; }
    .count-text { color: var(--c-text); }
  `,
})
export class PortalJobs {
  private readonly portal = inject(PortalService);
  private readonly publicApi = inject(PublicService);
  private readonly toasts = inject(ToastService);

  protected readonly i = { Briefcase, CircleCheck, CircleX, Clock, CloudOff, GraduationCap, Search, SearchX };
  protected readonly initials = initials;
  protected readonly statusBadge = statusBadge;
  protected readonly tone = scoreTone;
  protected readonly items = signal<JobWithFit[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly area = signal<AreaFilter>('all');
  protected readonly sort = signal<'fit' | 'recent'>('fit');
  protected readonly applying = signal<number | null>(null);

  protected readonly areaFilters = computed(() => {
    const counts = new Map<Area, number>();
    for (const { job } of this.items()) {
      const a = areaOf(job.required_skills);
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    return [
      { value: 'all' as AreaFilter, label: 'Todas', count: this.items().length },
      ...[...counts].map(([a, count]) => ({ value: a as AreaFilter, label: AREA_LABELS[a], count })),
    ];
  });

  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    const list = this.items().filter(
      (i) =>
        (this.area() === 'all' || areaOf(i.job.required_skills) === this.area()) &&
        (!term || normalize(`${i.job.title} ${i.job.description} ${i.job.required_skills.join(' ')}`).includes(term)),
    );
    if (this.sort() === 'recent') return [...list].sort((a, b) => b.job.created_at.localeCompare(a.job.created_at));
    return list;
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected areaLabel(skills: string[]): string {
    return AREA_LABELS[areaOf(skills)];
  }

  protected clear(): void {
    this.search.set('');
    this.area.set('all');
  }

  protected load(): void {
    this.error.set(null);
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
