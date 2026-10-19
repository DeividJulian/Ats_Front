import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Calendar, CircleCheck, CloudOff, FileText, Search, Star } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Candidate, JobRecommendation, MyApplication } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { statusBadge } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { AgoPipe } from '../../../shared/ago.pipe';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';
import { profileCompleteness } from '../profile-completeness';

/** Counters of the candidate home: active, in interview and shortlisted. */
export function applicationCounts(list: MyApplication[]) {
  return {
    total: list.length,
    active: list.filter((a) => a.status !== 'hired' && a.status !== 'rejected').length,
    interview: list.filter((a) => a.status === 'interview' || a.status === 'offer').length,
    shortlisted: list.filter((a) => a.status === 'shortlisted').length,
  };
}

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, LabelPipe, AgoPipe, Icon],
  template: `
    <div class="page">
      <div class="page-head">
        <div class="page-head__text">
          <h1 class="t-h1">Hola, {{ firstName() }}</h1>
          <p class="t-muted">{{ greeting() }}</p>
        </div>
        <a class="btn btn--primary" routerLink="/portal/vacantes"><app-icon [icon]="i.Search" [size]="18" />Buscar vacantes</a>
      </div>

      @if (loading()) {
        <div class="grid-4">@for (n of [1, 2, 3, 4]; track n) { <div class="card stack"><span class="skeleton sk-line"></span><span class="skeleton sk-title"></span></div> }</div>
        <div class="card stack"><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span></div>
      } @else if (error()) {
        <div class="card empty">
          <span class="empty__icon empty__icon--danger"><app-icon [icon]="i.CloudOff" [size]="32" /></span>
          <p class="empty__title">No pudimos cargar tu espacio</p>
          <p class="empty__text">{{ error() }}</p>
          <button type="button" class="btn btn--secondary" (click)="load()">Reintentar</button>
        </div>
      } @else {
        <div class="grid-4">
          <div class="card kpi">
            <div class="kpi__top"><span class="kpi__label">Postulaciones activas</span><span class="kpi__icon"><app-icon [icon]="i.FileText" [size]="20" /></span></div>
            <span class="kpi__value">{{ counts().active }}</span><span class="kpi__meta">de {{ counts().total }} enviadas</span>
          </div>
          <div class="card kpi">
            <div class="kpi__top"><span class="kpi__label">En entrevista u oferta</span><span class="kpi__icon tone-warn"><app-icon [icon]="i.Calendar" [size]="20" /></span></div>
            <span class="kpi__value">{{ counts().interview }}</span><span class="kpi__meta">Procesos avanzados</span>
          </div>
          <div class="card kpi">
            <div class="kpi__top"><span class="kpi__label">Preseleccionada</span><span class="kpi__icon"><app-icon [icon]="i.Star" [size]="20" /></span></div>
            <span class="kpi__value">{{ counts().shortlisted }}</span><span class="kpi__meta">La empresa se fijó en tu perfil</span>
          </div>
          @if (completeness(); as c) {
            <a class="card card--link kpi profile-kpi" routerLink="/portal/perfil">
              <div class="kpi__top"><span class="kpi__label">Tu perfil</span><span class="t-strong t-primary">{{ c.pct }} %</span></div>
              <div class="progress" role="progressbar" [attr.aria-valuenow]="c.pct" aria-valuemin="0" aria-valuemax="100" aria-label="Perfil completo"><div class="progress__bar" [style.width.%]="c.pct"></div></div>
              <span class="kpi__meta">{{ c.missing.length ? c.missing[0] + ' para llegar al 100 %' : '¡Perfil completo!' }}</span>
            </a>
          }
        </div>

        <div class="split split--wide">
          <section class="card stack">
            <div class="card__head" style="margin-bottom: 0">
              <h2 class="card__title">Tus postulaciones</h2>
              <a class="btn btn--ghost btn--sm" routerLink="/portal/postulaciones">Ver todas</a>
            </div>
            @if (applications().length === 0) {
              <div class="empty">
                <span class="empty__icon"><app-icon [icon]="i.FileText" [size]="32" /></span>
                <p class="empty__title">Todavía no te has postulado</p>
                <p class="empty__text">Elige una vacante recomendada y empieza hoy.</p>
              </div>
            } @else {
              <div class="list">
                @for (a of applications().slice(0, 5); track a.id; let n = $index) {
                  <div class="list__item">
                    <span class="avatar" [class]="tones[n % tones.length]">{{ initials(a.job_title) }}</span>
                    <div class="list__main">
                      <div class="list__title">{{ a.job_title }}</div>
                      <div class="list__sub">Postulada {{ (a.created_at | ago).toLowerCase() }}</div>
                    </div>
                    <span [class]="statusBadge(a.status)">{{ a.status | label: 'status' }}</span>
                  </div>
                }
              </div>
            }
            @if (nextInterview(); as a) {
              <div class="alert alert--info"><app-icon [icon]="i.Calendar" [size]="20" /><div class="alert__body"><div class="alert__title">Entrevista: {{ a.job_title }}</div>La empresa te contactará para acordar fecha y hora.</div></div>
            }
          </section>

          <section class="stack">
            <div class="row row--between"><h2 class="t-h3">Recomendadas para ti</h2><span class="t-small t-muted">Según tus habilidades</span></div>
            @if (recommended().length === 0) {
              <div class="card card--flat"><p class="t-small t-muted">No hay vacantes nuevas para ti por ahora. ¡Vuelve pronto!</p></div>
            }
            @for (job of recommended(); track job.job_id) {
              <div class="card stack stack--sm">
                <div class="row row--between">
                  <span class="score-pill" [class]="'score-pill--' + tone(job.classification)">{{ job.score }}</span>
                  <span class="chip" [class.chip--match]="job.missing_skills.length === 0">
                    @if (job.missing_skills.length === 0) { <app-icon [icon]="i.CircleCheck" [size]="15" /> }
                    {{ job.matching_skills.length }} de {{ job.matching_skills.length + job.missing_skills.length }} habilidades
                  </span>
                </div>
                <a class="t-h3 job-link" [routerLink]="['/empleos', job.job_id]">{{ job.title }}</a>
                @if (job.missing_skills.length) {
                  <p class="t-small t-muted">Te faltaría: {{ job.missing_skills.join(', ') }}</p>
                }
                <button type="button" class="btn btn--primary btn--sm" style="align-self: flex-start" [class.is-loading]="applying() === job.job_id" [disabled]="applying() === job.job_id" (click)="apply(job)">
                  @if (applying() === job.job_id) { <span class="spinner"></span>Enviando… } @else { Postularme }
                </button>
              </div>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .tone-warn { background: var(--c-warning-soft); color: var(--c-warning); }
    .profile-kpi { display: flex; }
    .job-link { color: var(--c-text); }
    .job-link:hover { color: var(--c-primary); }
  `,
})
export class PortalHome {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly i = { Calendar, CircleCheck, CloudOff, FileText, Search, Star };
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly initials = initials;
  protected readonly statusBadge = statusBadge;
  protected readonly tone = scoreTone;

  protected readonly profile = signal<Candidate | null>(null);
  protected readonly recommended = signal<JobRecommendation[]>([]);
  protected readonly applications = signal<MyApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly applying = signal<number | null>(null);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly counts = computed(() => applicationCounts(this.applications()));
  protected readonly nextInterview = computed(() => this.applications().find((a) => a.status === 'interview'));
  protected readonly completeness = computed(() => {
    const p = this.profile();
    return p ? profileCompleteness(p) : null;
  });
  protected readonly greeting = computed(() => {
    const n = this.recommended().length;
    const interviews = this.counts().interview;
    const parts = [];
    if (interviews) parts.push(interviews === 1 ? 'Tienes 1 proceso en entrevista' : `Tienes ${interviews} procesos en entrevista`);
    if (n) parts.push(n === 1 ? '1 vacante encaja contigo' : `${n} vacantes encajan contigo`);
    return parts.length ? parts.join(' y ') + '.' : 'Aquí ves las vacantes que mejor encajan contigo y cómo van tus postulaciones.';
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    this.error.set(null);
    forkJoin({
      profile: this.portal.profile(),
      recommended: this.portal.recommendedJobs(3),
      applications: this.portal.applications(),
    }).subscribe({
      next: (r) => {
        this.profile.set(r.profile);
        this.recommended.set(r.recommended);
        this.applications.set(r.applications);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected apply(job: JobRecommendation): void {
    this.applying.set(job.job_id);
    this.portal.apply(job.job_id).subscribe({
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
