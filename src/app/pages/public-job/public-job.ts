import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { PublicJob } from '../../core/models';
import { PortalService, PublicService } from '../../core/services/api.services';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { PublicHeader } from '../../layout/public-header';
import { LabelPipe } from '../../shared/label.pipe';

@Component({
  selector: 'app-public-job',
  imports: [RouterLink, PublicHeader, LabelPipe],
  template: `
    <app-public-header />
    <div class="page narrow">
      <a routerLink="/" fragment="vacantes" class="small">← Todas las vacantes</a>

      @if (loading()) {
        <div class="card stack"><div class="skeleton" style="width: 50%"></div><div class="skeleton"></div><div class="skeleton"></div></div>
      } @else if (error()) {
        <div class="empty"><span class="big">🔒</span><strong>{{ error() }}</strong><a class="btn small" routerLink="/">Volver al inicio</a></div>
      } @else if (job(); as job) {
        <div class="card stack job">
          <span class="eyebrow">Vacante abierta</span>
          <h1>{{ job.title }}</h1>
          <div class="row small subtle">
            <span>⏱ {{ job.min_experience_years ? job.min_experience_years + ' años de experiencia' : 'Sin experiencia mínima' }}</span>
            <span>🎓 {{ job.min_education_level | label: 'education' }}</span>
          </div>
          <h3>Descripción</h3>
          <p class="pre">{{ job.description }}</p>
          @if (job.requirements) {
            <h3>Requisitos</h3>
            <p class="pre">{{ job.requirements }}</p>
          }
          <h3>Habilidades que buscamos</h3>
          <div class="chips">
            @for (skill of job.required_skills; track skill) {
              <span class="chip">{{ skill }}</span>
            }
          </div>
        </div>

        <div class="card apply">
          @if (applied()) {
            <div class="notice good">✓ Te postulaste a esta vacante. Sigue su estado en <a routerLink="/portal/postulaciones">Mis postulaciones</a>.</div>
          } @else if (auth.role() === 'candidate') {
            <div><strong>¿Te interesa?</strong><p class="subtle small">El equipo de selección verá tu perfil al instante.</p></div>
            <button type="button" class="btn primary large" [disabled]="applying()" (click)="apply(job.id)">
              {{ applying() ? 'Enviando…' : 'Postularme ahora' }}
            </button>
          } @else if (auth.isStaff()) {
            <div><strong>Estás viendo la vacante como la ve un candidato.</strong></div>
            <a class="btn" [routerLink]="['/app/vacantes', job.id]">Ver ranking de la vacante</a>
          } @else {
            <div><strong>¿Te interesa esta vacante?</strong><p class="subtle small">Crea tu cuenta gratis en menos de un minuto y postúlate.</p></div>
            <div class="row">
              <a class="btn primary large" routerLink="/registro" [queryParams]="{ redirect: '/empleos/' + job.id }">Crear cuenta y postularme</a>
              <a class="btn" routerLink="/login" [queryParams]="{ redirect: '/empleos/' + job.id }">Ya tengo cuenta</a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 860px; }
    .job h1 { font-size: clamp(26px, 4vw, 36px); }
    .apply { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; border-color: rgba(245, 165, 36, 0.45); }
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

  protected readonly job = signal<PublicJob | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly applying = signal(false);
  protected readonly applied = signal(false);

  ngOnInit(): void {
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
}
