import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Candidate, JobRecommendation, MyApplication } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { ScoreBar } from '../../../shared/score-bar';
import { profileCompleteness } from '../profile-completeness';

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, LabelPipe, ScoreBar],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Tu espacio</div>
          <h1>Hola, {{ firstName() }} 👋</h1>
          <p class="subtle">Aquí ves las vacantes que mejor encajan contigo y cómo van tus postulaciones.</p>
        </div>
        <a class="btn primary" routerLink="/portal/vacantes">Explorar vacantes</a>
      </div>

      @if (loading()) {
        <div class="card stack"><div class="skeleton"></div><div class="skeleton"></div></div>
      } @else if (error()) {
        <div class="empty"><strong>{{ error() }}</strong><button type="button" class="btn small" (click)="load()">Reintentar</button></div>
      } @else {
        @if (completeness(); as c) {
          @if (c.pct < 100) {
            <div class="card complete">
              <div class="ring" [style.--pct]="c.pct"><span>{{ c.pct }}%</span></div>
              <div class="stack" style="flex: 1">
                <h2>Completa tu perfil para destacar</h2>
                <p class="subtle small">Un perfil completo recibe mejores recomendaciones y llega más arriba en los rankings.</p>
                <ul class="small">@for (m of c.missing; track m) { <li>{{ m }}</li> }</ul>
              </div>
              <a class="btn primary" routerLink="/portal/perfil">Completar perfil</a>
            </div>
          }
        }

        <div class="grid cols-2">
          <div class="card stack">
            <h2>✨ Recomendadas para ti</h2>
            @if (recommended().length === 0) {
              <p class="subtle small">No hay vacantes nuevas para ti por ahora. ¡Vuelve pronto!</p>
            }
            @for (job of recommended(); track job.job_id) {
              <div class="rec stack">
                <div class="row">
                  <a [routerLink]="['/empleos', job.job_id]"><strong>{{ job.title }}</strong></a>
                  <span class="spacer"></span>
                  <button type="button" class="btn small primary" [disabled]="applying() === job.job_id" (click)="apply(job)">Postularme</button>
                </div>
                <app-score-bar [score]="job.score" [classification]="job.classification" />
                @if (job.missing_skills.length) {
                  <span class="small subtle">Te faltaría: {{ job.missing_skills.join(', ') }}</span>
                }
              </div>
            }
          </div>

          <div class="card stack">
            <div class="row"><h2>📋 Tus postulaciones</h2><span class="spacer"></span><a class="small" routerLink="/portal/postulaciones">Ver todas →</a></div>
            @if (applications().length === 0) {
              <p class="subtle small">Todavía no te has postulado. Elige una vacante recomendada y empieza.</p>
            }
            @for (a of applications().slice(0, 4); track a.id) {
              <div class="row app">
                <strong class="small" style="flex: 1">{{ a.job_title }}</strong>
                <span class="badge" [class]="a.status">{{ a.status | label: 'status' }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .complete { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; border-color: rgba(245, 165, 36, 0.5); }
    .complete ul { padding-left: 18px; color: var(--muted); }
    .ring { --pct: 0; width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--accent) calc(var(--pct) * 1%), var(--surface-2) 0); }
    .ring span { width: 66px; height: 66px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); font-weight: 800; }
    .rec { padding: 12px; border-radius: 12px; background: var(--surface-2); gap: 8px; }
    .app { padding: 10px 12px; border-radius: 10px; background: var(--surface-2); }
  `,
})
export class PortalHome {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly profile = signal<Candidate | null>(null);
  protected readonly recommended = signal<JobRecommendation[]>([]);
  protected readonly applications = signal<MyApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly applying = signal<number | null>(null);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly completeness = computed(() => {
    const p = this.profile();
    return p ? profileCompleteness(p) : null;
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
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
