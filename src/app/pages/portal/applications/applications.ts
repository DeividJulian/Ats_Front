import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApplicationStatus, MyApplication } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { APPLICATION_STATUS_LABELS, PIPELINE } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';

export interface TimelineStep {
  status: ApplicationStatus;
  label: string;
  state: 'done' | 'current' | 'pending';
}

/** Steps of the hiring process with how far this application got. */
export function timeline(status: ApplicationStatus): TimelineStep[] {
  const reached = status === 'rejected' ? -1 : PIPELINE.indexOf(status);
  return PIPELINE.map((step, i) => ({
    status: step,
    label: APPLICATION_STATUS_LABELS[step],
    state: i < reached ? 'done' : i === reached ? 'current' : 'pending',
  }));
}

const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  new: 'Recibimos tu postulación. El equipo de selección la revisará pronto.',
  shortlisted: '¡Buenas noticias! Pasaste el primer filtro.',
  interview: 'Estás en etapa de entrevista. Prepárate: revisa las habilidades de la vacante.',
  offer: '¡Tienes una oferta! El equipo se pondrá en contacto contigo.',
  hired: '¡Felicitaciones, fuiste contratado! 🎉',
  rejected: 'En esta ocasión no continuaste en el proceso. Sigue postulándote: hay más vacantes para ti.',
};

@Component({
  selector: 'app-portal-applications',
  imports: [RouterLink, DatePipe],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Postulaciones</div>
          <h1>Mis postulaciones</h1>
          <p class="subtle">Sigue en qué etapa va cada proceso.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card stack"><div class="skeleton"></div><div class="skeleton"></div></div>
      } @else if (applications().length === 0) {
        <div class="empty">
          <span class="big">📋</span>
          <strong>Todavía no te has postulado a ninguna vacante</strong>
          <a class="btn primary small" routerLink="/portal/vacantes">Ver vacantes</a>
        </div>
      } @else {
        <div class="list">
          @for (a of applications(); track a.id) {
            <div class="card stack">
              <div class="row">
                <a [routerLink]="['/empleos', a.job_id]"><h3>{{ a.job_title }}</h3></a>
                <span class="spacer"></span>
                <span class="small subtle">Desde el {{ a.created_at | date: 'd MMM y' }}</span>
              </div>

              <ol class="timeline" [class.rejected]="a.status === 'rejected'">
                @for (step of steps(a.status); track step.status) {
                  <li [class]="step.state"><span class="dot"></span><span class="small">{{ step.label }}</span></li>
                }
              </ol>

              <div class="notice small" [class.good]="a.status === 'hired' || a.status === 'offer'" [class.error]="a.status === 'rejected'">{{ message(a.status) }}</div>

              @if (a.missing_skills.length && a.status !== 'hired') {
                <span class="small subtle">Para destacar en vacantes como esta, fortalece: {{ a.missing_skills.join(', ') }}</span>
              }
              @if (a.status !== 'hired') {
                <div><button type="button" class="btn small ghost danger" (click)="withdraw(a)">Retirar postulación</button></div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .list { display: grid; gap: 14px; }
    h3 { color: var(--text); }
    .timeline { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .timeline li { display: grid; justify-items: center; gap: 6px; text-align: center; position: relative; color: var(--muted); }
    .timeline li::before { content: ''; position: absolute; top: 9px; left: -50%; width: 100%; height: 3px; background: var(--surface-3); z-index: 0; }
    .timeline li:first-child::before { display: none; }
    .dot { width: 20px; height: 20px; border-radius: 50%; background: var(--surface-3); border: 3px solid var(--surface); position: relative; z-index: 1; }
    .timeline .done { color: var(--text); }
    .timeline .done .dot, .timeline .done::before, .timeline .current::before { background: var(--good); }
    .timeline .current { color: var(--text); font-weight: 700; }
    .timeline .current .dot { background: var(--accent); box-shadow: 0 0 0 4px rgba(245, 165, 36, 0.25); }
    .timeline.rejected .dot { background: var(--surface-3); }
  `,
})
export class PortalApplications {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);

  protected readonly applications = signal<MyApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly steps = timeline;

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    this.portal.applications().subscribe({
      next: (list) => {
        this.applications.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected message(status: ApplicationStatus): string {
    return STATUS_MESSAGES[status];
  }

  protected withdraw(a: MyApplication): void {
    if (!confirm(`¿Retirar tu postulación a "${a.job_title}"?`)) return;
    this.portal.withdraw(a.id).subscribe({
      next: () => {
        this.applications.update((list) => list.filter((x) => x.id !== a.id));
        this.toasts.ok('Postulación retirada');
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }
}
