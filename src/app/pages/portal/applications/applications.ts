import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Check, FileText } from 'lucide-angular';

import { ApplicationStatus, MyApplication } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { APPLICATION_STATUS_LABELS, PIPELINE, statusBadge } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';

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
  hired: '¡Felicitaciones, fuiste contratado! La empresa te contactará para la firma del contrato.',
  rejected: 'En esta ocasión no continuaste en el proceso. Tu hoja de vida sigue activa para nuevas vacantes.',
};

type Filter = 'all' | ApplicationStatus;

@Component({
  selector: 'app-portal-applications',
  imports: [RouterLink, DatePipe, LabelPipe, Icon],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div class="page-head__text">
          <h1 class="t-h1">Mis postulaciones</h1>
          <p class="t-muted">Sigue en qué etapa va cada proceso.</p>
        </div>
      </div>

      @if (loading()) {
        <div class="card stack"><span class="skeleton sk-title"></span><span class="skeleton sk-line"></span><span class="skeleton sk-line"></span></div>
      } @else if (applications().length === 0) {
        <div class="card empty">
          <span class="empty__icon"><app-icon [icon]="i.FileText" [size]="32" /></span>
          <p class="empty__title">Todavía no te has postulado a ninguna vacante</p>
          <p class="empty__text">Las vacantes están ordenadas según qué tan bien encajan contigo.</p>
          <a class="btn btn--primary" routerLink="/portal/vacantes">Ver vacantes</a>
        </div>
      } @else {
        <div class="tabs" role="tablist" aria-label="Filtrar por estado">
          @for (t of tabs(); track t.value) {
            <button type="button" class="tab" role="tab" [class.is-active]="filter() === t.value" [attr.aria-selected]="filter() === t.value" (click)="filter.set(t.value)">
              {{ t.label }} <span class="count">{{ t.count }}</span>
            </button>
          }
        </div>

        <div class="stack">
          @for (a of visible(); track a.id) {
            <article class="card stack">
              <div class="row row--nowrap row--top">
                <span class="avatar">{{ initials(a.job_title) }}</span>
                <div class="list__main">
                  <h2 class="t-h3"><a class="title-link" [routerLink]="['/empleos', a.job_id]">{{ a.job_title }}</a></h2>
                  <p class="t-small t-muted">Postulada el {{ a.created_at | date: 'd MMM y' }}</p>
                </div>
                <span [class]="statusBadge(a.status)">{{ a.status | label: 'status' }}</span>
              </div>

              @if (a.status !== 'rejected') {
                <ol class="steps" aria-label="Avance del proceso">
                  @for (s of steps(a.status); track s.status; let last = $last) {
                    <li class="steps__item" [class.is-done]="s.state === 'done' || (s.state === 'current' && last)" [class.is-current]="s.state === 'current' && !last">
                      <span class="steps__dot">@if (s.state === 'done' || (s.state === 'current' && last)) { <app-icon [icon]="i.Check" [size]="13" [stroke]="3" /> }</span>
                      <span class="lbl">{{ s.label }}</span>
                      @if (!last) { <span class="steps__line"></span> }
                    </li>
                  }
                </ol>
              }

              <p class="t-small note" [class.note--good]="a.status === 'hired' || a.status === 'offer'">{{ message(a.status) }}</p>

              @if (a.missing_skills.length && a.status !== 'hired') {
                <p class="t-small t-muted">Para destacar en vacantes como esta, fortalece: {{ a.missing_skills.join(', ') }}</p>
              }
              <div class="row">
                <a class="btn btn--ghost btn--sm" [routerLink]="['/empleos', a.job_id]">Ver vacante</a>
                @if (a.status !== 'hired' && a.status !== 'rejected') {
                  <button type="button" class="btn btn--danger-ghost btn--sm" (click)="withdraw(a)">Retirar postulación</button>
                }
              </div>
            </article>
          } @empty {
            <div class="card card--flat"><p class="t-small t-muted">No tienes postulaciones en este estado.</p></div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 1000px; }
    .title-link { color: var(--c-text); }
    .title-link:hover { color: var(--c-primary); }
    .note { padding: 12px 14px; background: var(--c-surface-2); border-radius: 12px; color: var(--c-text-2); }
    .note--good { background: var(--c-success-soft); color: var(--c-text); }
  `,
})
export class PortalApplications {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);

  protected readonly i = { Check, FileText };
  protected readonly initials = initials;
  protected readonly statusBadge = statusBadge;
  protected readonly applications = signal<MyApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<Filter>('all');
  protected readonly steps = timeline;

  protected readonly tabs = computed(() => {
    const list = this.applications();
    const statuses = [...PIPELINE, 'rejected' as const].filter((s) => list.some((a) => a.status === s));
    return [
      { value: 'all' as Filter, label: 'Todas', count: list.length },
      ...statuses.map((s) => ({ value: s as Filter, label: APPLICATION_STATUS_LABELS[s], count: list.filter((a) => a.status === s).length })),
    ];
  });

  protected readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.applications() : this.applications().filter((a) => a.status === f);
  });

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
