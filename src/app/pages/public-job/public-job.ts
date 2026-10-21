import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Briefcase, ChevronRight, CircleCheck, Clock, GraduationCap, Info, Lock, Share2 } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { PublicJob } from '../../core/models';
import { PortalService, PublicService } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage, initials } from '../../core/utils/http-error';
import { PublicHeader } from '../../layout/public-header';
import { AgoPipe } from '../../shared/ago.pipe';
import { Icon } from '../../shared/icon';
import { LabelPipe } from '../../shared/label.pipe';
import { YearsPipe } from '../../shared/years.pipe';

/** Text split into paragraphs, one per non-empty line. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

@Component({
  selector: 'app-public-job',
  imports: [RouterLink, PublicHeader, LabelPipe, AgoPipe, Icon, YearsPipe],
  template: `
    <app-public-header />
    <main class="container page-body">
      <nav class="crumbs" aria-label="Ruta">
        <a routerLink="/">Inicio</a><app-icon [icon]="i.ChevronRight" [size]="14" />
        <a routerLink="/" fragment="vacantes">Vacantes</a><app-icon [icon]="i.ChevronRight" [size]="14" />
        <span>{{ job()?.title ?? 'Vacante' }}</span>
      </nav>

      @if (loading()) {
        <div class="split">
          <div class="card card--lg stack"><span class="skeleton sk-title"></span><span class="skeleton sk-line"></span><span class="skeleton sk-block"></span></div>
          <div class="card card--lg stack"><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span></div>
        </div>
      } @else if (error()) {
        <div class="card empty">
          <span class="empty__icon empty__icon--danger"><app-icon [icon]="i.Lock" [size]="32" /></span>
          <p class="empty__title">{{ error() }}</p>
          <p class="empty__text">Puede que la vacante ya se haya cerrado.</p>
          <a class="btn btn--secondary" routerLink="/" fragment="vacantes">Ver otras vacantes</a>
        </div>
      } @else if (job(); as job) {
        <div class="split">
          <article class="stack stack--lg job">
            <div class="card card--lg">
              <div class="row row--nowrap row--top">
                <span class="avatar avatar--lg">{{ initials(job.title) }}</span>
                <div class="stack stack--sm" style="flex: 1; min-width: 0">
                  <span class="t-label">Vacante abierta</span>
                  <h1 class="t-h1">{{ job.title }}</h1>
                  <div class="meta">
                    <span><app-icon [icon]="i.Briefcase" [size]="16" />{{ job.min_experience_years ? (job.min_experience_years | years) + ' de experiencia' : 'Sin experiencia mínima' }}</span>
                    <span><app-icon [icon]="i.GraduationCap" [size]="16" />{{ job.min_education_level | label: 'education' }}</span>
                    <span><app-icon [icon]="i.Clock" [size]="16" />Publicada {{ (job.created_at | ago).toLowerCase() }}</span>
                  </div>
                </div>
                <span class="badge badge--dot badge--abierta hide-m">Abierta</span>
              </div>
            </div>

            <div class="card card--lg stack">
              <h2 class="t-h2">Sobre el cargo</h2>
              @for (p of paragraphs(job.description); track $index) { <p>{{ p }}</p> }
              @if (job.requirements) {
                <h3 class="t-h3">Lo que buscamos</h3>
                <ul class="stack stack--sm">
                  @for (p of paragraphs(job.requirements); track $index) {
                    <li class="row row--nowrap row--top"><app-icon class="tick" [icon]="i.CircleCheck" [size]="18" />{{ p }}</li>
                  }
                </ul>
              }
              @if (job.required_skills.length) {
                <h3 class="t-h3">Habilidades</h3>
                <div class="chips">@for (skill of job.required_skills; track skill) { <span class="chip">{{ skill }}</span> }</div>
              }
            </div>

            <div class="card card--flat row row--nowrap row--top">
              <app-icon [icon]="i.Info" [size]="20" class="t-muted" />
              <p class="t-small t-muted">Al postularte, el sistema compara tu hoja de vida con esta vacante para ordenar a los candidatos. La empresa ve tu puntaje y su explicación; tú ves el estado de tu proceso en <span class="t-strong">Mis postulaciones</span>.</p>
            </div>
          </article>

          <aside class="stack">
            <div class="card card--lg stack apply">
              <div>
                <p class="t-label">Requisitos mínimos</p>
                <p class="t-h3">{{ job.required_skills.length }} habilidades clave</p>
              </div>
              <div class="divider"></div>
              <div class="stack stack--sm t-small">
                <div class="row row--between"><span class="t-muted">Experiencia</span><span class="t-strong">{{ job.min_experience_years ? (job.min_experience_years | years) : 'No exigida' }}</span></div>
                <div class="row row--between"><span class="t-muted">Educación</span><span class="t-strong">{{ job.min_education_level | label: 'education' }}</span></div>
                <div class="row row--between"><span class="t-muted">Publicada</span><span class="t-strong">{{ job.created_at | ago }}</span></div>
              </div>

              @if (applied()) {
                <div class="alert alert--success" role="status"><app-icon [icon]="i.CircleCheck" [size]="20" /><div class="alert__body"><div class="alert__title">¡Listo, te postulaste!</div>Sigue el proceso en <a routerLink="/portal/postulaciones">Mis postulaciones</a>.</div></div>
              } @else if (auth.role() === 'candidate') {
                <button type="button" class="btn btn--primary btn--lg btn--block" [class.is-loading]="applying()" [disabled]="applying()" (click)="apply(job.id)">
                  @if (applying()) { <span class="spinner"></span>Enviando postulación… } @else { Postularme }
                </button>
              } @else if (auth.isStaff()) {
                <p class="t-small t-muted">Estás viendo la vacante como la ve un candidato.</p>
                <a class="btn btn--primary btn--block" [routerLink]="['/app/vacantes', job.id]">Ver ranking de la vacante</a>
              } @else {
                <a class="btn btn--primary btn--lg btn--block" routerLink="/registro" [queryParams]="{ redirect: '/empleos/' + job.id }">Crear cuenta y postularme</a>
                <a class="btn btn--secondary btn--block" routerLink="/login" [queryParams]="{ redirect: '/empleos/' + job.id }">Ya tengo cuenta</a>
              }
              <button type="button" class="btn btn--ghost btn--block" (click)="share(job)"><app-icon [icon]="i.Share2" [size]="18" />Compartir vacante</button>
              <p class="t-xs t-muted" style="text-align: center">Necesitas una cuenta de candidato con tu hoja de vida.</p>
            </div>
          </aside>
        </div>
      }
    </main>
  `,
  styles: `
    .page-body { padding-top: 28px; padding-bottom: 72px; display: flex; flex-direction: column; gap: 20px; }
    .apply { box-shadow: var(--shadow-2); position: sticky; top: 96px; }
    .tick { color: var(--c-success); margin-top: 2px; }
    @media (max-width: 1100px) { .apply { position: static; } }
  `,
})
export class PublicJobPage implements OnInit {
  /** Route parameter (/empleos/:id) */
  readonly id = input.required<string>();

  private readonly publicApi = inject(PublicService);
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly i = { Briefcase, ChevronRight, CircleCheck, Clock, GraduationCap, Info, Lock, Share2 };
  protected readonly initials = initials;
  protected readonly paragraphs = paragraphs;
  protected readonly job = signal<PublicJob | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly applying = signal(false);
  protected readonly applied = signal(false);

  ngOnInit(): void {
    // A candidate who already applied sees it, instead of a button that would only answer "already applied"
    if (this.auth.role() === 'candidate') {
      this.portal.applications().subscribe({
        next: (list) => this.applied.set(list.some((a) => a.job_id === Number(this.id()))),
        error: () => undefined,
      });
    }
    this.publicApi.job(Number(this.id())).subscribe({
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

  protected apply(jobId: number): void {
    this.applying.set(true);
    this.portal.apply(jobId).subscribe({
      next: () => {
        this.applied.set(true);
        this.applying.set(false);
        this.toasts.ok('¡Listo! Tu postulación fue enviada');
      },
      error: (e) => {
        this.applying.set(false);
        this.toasts.error(errorMessage(e));
        if (errorMessage(e).includes('ya está postulado')) void this.router.navigateByUrl('/portal/postulaciones');
      },
    });
  }

  /** Native share sheet on phones; on computers the link goes to the clipboard. */
  protected share(job: PublicJob): void {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: job.title, url }).catch(() => undefined);
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => this.toasts.ok('Enlace copiado: pégalo donde quieras compartirlo'),
      () => this.toasts.info(url),
    );
  }
}
