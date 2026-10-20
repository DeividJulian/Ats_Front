import { KeyValuePipe } from '@angular/common';
import { Component, computed, effect, inject, Injectable, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CircleCheck,
  CircleX,
  GraduationCap,
  Info,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-angular';

import { AiEvaluation, AiStatus, Application, ApplicationStatus, InterviewGuide, RankingItem } from '../../../core/models';
import { AiService, ApplicationService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { NEXT_STATUSES, statusLabel } from '../../../core/utils/labels';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';

/** AI evaluations already made in this visit, so switching candidates does not ask the model again. */
@Injectable({ providedIn: 'root' })
export class EvaluationCache {
  readonly byApplication = signal<Record<number, AiEvaluation>>({});

  set(evaluation: AiEvaluation): void {
    this.byApplication.update((all) => ({ ...all, [evaluation.application_id]: evaluation }));
  }
}

/** Design tone of the AI recommendation: green to advance, amber with reservations, red to reject. */
export function recommendationTone(recommendation: string): 'alto' | 'medio' | 'bajo' {
  if (recommendation === 'advance') return 'alto';
  if (recommendation === 'interview_with_reservations') return 'medio';
  return 'bajo';
}

/** Everything about one application: score, breakdown, explanation, status, interview guide and AI evaluation. */
@Component({
  selector: 'app-application-review',
  imports: [RouterLink, LabelPipe, KeyValuePipe, Icon],
  template: `
    @if (application(); as app) {
      <div class="stack stack--lg">
        <div class="card card--lg stack stack--lg">
          @if (item(); as it) {
            <div class="row row--nowrap row--top">
              <span class="avatar avatar--lg">{{ blind() ? '#' + it.position : initials(it.name) }}</span>
              <div class="list__main stack stack--sm">
                <h2 class="t-h2">{{ it.name }}</h2>
                <div class="meta">
                  @if (blind()) {
                    <span><app-icon [icon]="i.ShieldCheck" [size]="16" />Datos personales ocultos</span>
                  } @else if (it.email) {
                    <span>{{ it.email }}</span>
                  }
                  <span>Puesto {{ it.position }} del ranking</span>
                </div>
              </div>
              @if (!blind()) {
                <a class="btn btn--secondary btn--sm hide-m" [routerLink]="['/app/candidatos', it.candidate_id]">Ver perfil</a>
              }
            </div>
          }

          <div class="score-status">
            <div class="score" [class]="'score--' + tone(app.details.classification)">
              <div class="score__top">
                <span class="score__value">{{ app.score }}<small>/100</small></span>
                <span class="badge" [class]="'badge--' + tone(app.details.classification)">{{ app.details.classification | label: 'classification' }}</span>
              </div>
              <div class="score__track" role="img" [attr.aria-label]="app.score + ' de 100'"><div class="score__fill" [style.width.%]="app.score"></div></div>
            </div>
            <div class="field">
              <label class="field__label" [for]="'st-' + app.id">Estado</label>
              <select class="select" [id]="'st-' + app.id" [disabled]="!editable() || changing() || !next(status()).length" (change)="changeStatus($any($event.target).value)">
                <option [value]="status()" selected>{{ status() | label: 'status' }}</option>
                @for (s of next(status()); track s) { <option [value]="s">{{ s === 'rejected' ? 'Rechazar' : 'Pasar a ' + (s | label: 'status') }}</option> }
              </select>
            </div>
          </div>

          <div class="grid-2" style="gap: 28px">
            <div class="stack">
              <p class="t-label">Desglose del puntaje</p>
              <div class="breakdown">
                @for (part of app.details.breakdown | keyvalue; track part.key) {
                  <div class="breakdown__row">
                    <span class="breakdown__label">{{ part.key | label: 'breakdown' }}</span>
                    <span class="breakdown__bar"><span [style.width.%]="part.value"></span></span>
                    <span class="breakdown__val">{{ part.value }}</span>
                  </div>
                }
              </div>
            </div>
            <div class="stack">
              <p class="t-label">Por qué este puntaje</p>
              <ul class="stack stack--sm t-small">
                @for (line of app.details.explanation; track $index) {
                  <li class="row row--nowrap row--top"><app-icon class="t-muted" [icon]="i.Info" [size]="16" /><span>{{ line }}</span></li>
                }
              </ul>
              <div class="chips">
                @for (m of app.details.matching_skills; track m) { <span class="chip chip--match"><app-icon [icon]="i.CircleCheck" [size]="15" />{{ m }}</span> }
                @for (m of app.details.missing_skills; track m) { <span class="chip chip--miss"><app-icon [icon]="i.CircleX" [size]="15" />{{ m }}</span> }
              </div>
            </div>
          </div>
        </div>

        <div class="card card--lg">
          <div class="tabs" role="tablist">
            <button type="button" class="tab" role="tab" [class.is-active]="tab() === 'guide'" [attr.aria-selected]="tab() === 'guide'" (click)="tab.set('guide')">
              <app-icon [icon]="i.MessageCircle" [size]="18" />Guía de entrevista
            </button>
            <button type="button" class="tab tab--ia" role="tab" [class.is-active]="tab() === 'ai'" [attr.aria-selected]="tab() === 'ai'" (click)="tab.set('ai')">
              <app-icon [icon]="i.Sparkles" [size]="18" />Evaluación con IA
            </button>
          </div>

          @if (tab() === 'guide') {
            <div class="stack tab-body">
              @if (guide(); as g) {
                <p class="t-small t-muted">{{ g.focus }}</p>
                <ol class="stack">
                  @for (q of g.questions; track $index; let n = $index) {
                    <li class="row row--nowrap row--top">
                      <span class="step-card__num q-num">{{ n + 1 }}</span>
                      <div><p class="t-strong">{{ q.question }}</p><p class="t-small t-muted">{{ q.type | label: 'questionType' }}</p></div>
                    </li>
                  }
                </ol>
                @if (g.training_for_gaps.length) {
                  <div class="divider"></div>
                  <p class="t-label row" style="gap: 6px"><app-icon [icon]="i.GraduationCap" [size]="16" />Si lo contratas, formación sugerida</p>
                  <ul class="stack stack--sm t-small">
                    @for (t of g.training_for_gaps; track t.skill) { <li><span class="t-strong">{{ t.skill }}:</span> {{ t.suggestion }}</li> }
                  </ul>
                }
              } @else if (guideError()) {
                <div class="alert alert--danger"><app-icon [icon]="i.TriangleAlert" [size]="20" /><div class="alert__body">{{ guideError() }}</div></div>
              } @else {
                <span class="skeleton sk-line" style="width: 70%"></span><span class="skeleton sk-line"></span><span class="skeleton sk-line" style="width: 85%"></span>
              }
            </div>
          } @else {
            <div class="stack tab-body">
              <div class="alert alert--ia"><app-icon [icon]="i.ShieldCheck" [size]="20" /><div class="alert__body">La IA es asesora: no cambia el puntaje y no recibe nombre, correo ni teléfono.</div></div>

              @if (evaluating()) {
                <div class="stack" aria-busy="true" aria-label="Evaluando con IA">
                  <div class="row t-ia t-strong"><span class="spinner"></span>Analizando la hoja de vida frente a la vacante…</div>
                  <span class="skeleton sk-line" style="width: 70%"></span><span class="skeleton sk-line"></span><span class="skeleton sk-line" style="width: 85%"></span>
                </div>
              } @else if (evaluation(); as ev) {
                <div class="stack stack--lg">
                  <div class="card card--ia card--tight row row--nowrap" style="align-items: center">
                    <span class="ia-mark"><app-icon [icon]="i.Sparkles" [size]="18" /></span>
                    <div class="list__main"><p class="t-label t-ia">Recomendación</p><p class="t-h3">{{ ev.recommendation | label: 'recommendation' }}</p></div>
                    <span class="badge" [class]="'badge--' + recTone(ev.recommendation)">Puntaje del sistema: {{ ev.system_score }}</span>
                  </div>
                  <p>{{ ev.summary }}</p>
                  <div class="grid-2">
                    <div class="stack stack--sm">
                      <p class="t-label">Fortalezas</p>
                      <ul class="stack stack--sm t-small">@for (s of ev.strengths; track $index) { <li class="row row--nowrap row--top"><app-icon class="ok" [icon]="i.CircleCheck" [size]="16" />{{ s }}</li> }</ul>
                    </div>
                    <div class="stack stack--sm">
                      <p class="t-label">Brechas</p>
                      <ul class="stack stack--sm t-small">@for (s of ev.gaps; track $index) { <li class="row row--nowrap row--top"><app-icon class="warn" [icon]="i.TriangleAlert" [size]="16" />{{ s }}</li> }</ul>
                    </div>
                  </div>
                  <div class="stack stack--sm">
                    <p class="t-label">Preguntas sugeridas</p>
                    <ol class="stack stack--sm t-small">@for (q of ev.interview_questions; track $index) { <li class="row row--nowrap row--top"><app-icon class="t-ia" [icon]="i.MessageCircle" [size]="16" />{{ q }}</li> }</ol>
                  </div>
                  <div class="row">
                    <button type="button" class="btn btn--ia-soft btn--sm" (click)="evaluate(app.id)"><app-icon [icon]="i.RefreshCw" [size]="16" />Volver a evaluar</button>
                    <span class="t-xs t-muted">Generado por {{ aiStatus()?.provider | label: 'aiProvider' }}</span>
                  </div>
                </div>
              } @else {
                @if (aiError()) {
                  <div class="alert alert--danger" role="alert"><app-icon [icon]="i.TriangleAlert" [size]="20" /><div class="alert__body"><div class="alert__title">No se pudo evaluar</div>{{ aiError() }}</div></div>
                }
                <div class="empty ai-empty">
                  <span class="empty__icon ai-icon"><app-icon [icon]="i.Sparkles" [size]="32" /></span>
                  <p class="empty__title">Aún no hay evaluación</p>
                  @if (aiStatus()?.configured) {
                    <p class="empty__text">Pide a {{ aiStatus()?.provider | label: 'aiProvider' }} una recomendación, fortalezas, brechas y preguntas para esta postulación.</p>
                    <button type="button" class="btn btn--ia" (click)="evaluate(app.id)"><app-icon [icon]="i.Sparkles" [size]="18" />Evaluar con IA</button>
                  } @else {
                    <p class="empty__text">La IA no está configurada en el servidor (falta AI_API_KEY). El puntaje y la guía de entrevista funcionan igual.</p>
                    <button type="button" class="btn btn--ia" disabled>Evaluar con IA</button>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else if (loadError()) {
      <div class="card empty">
        <span class="empty__icon empty__icon--danger"><app-icon [icon]="i.TriangleAlert" [size]="32" /></span>
        <p class="empty__title">No pudimos cargar la postulación</p>
        <p class="empty__text">{{ loadError() }}</p>
      </div>
    } @else {
      <div class="card card--lg stack"><span class="skeleton sk-title"></span><span class="skeleton sk-line"></span><span class="skeleton sk-block"></span></div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .score-status { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 20px; align-items: end; }
    .tab-body { padding-top: 20px; }
    .q-num { width: 28px; height: 28px; border-radius: 9px; font-size: 13px; flex: none; }
    .ai-empty { padding: 28px 16px; }
    .ai-icon { background: var(--c-ia-soft); color: var(--c-ia); }
    .ok { color: var(--c-success); margin-top: 2px; }
    .warn { color: var(--c-warning); margin-top: 2px; }
    @media (max-width: 760px) { .score-status { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class ApplicationReview {
  readonly applicationId = input.required<number>();
  /** Row of the ranking: name, email and position (optional). */
  readonly item = input<RankingItem | null>(null);
  readonly blind = input(false);
  /** False when the job is closed: the status can't change. */
  readonly editable = input(true);
  /** Tells the parent the status changed, to reload the ranking. */
  readonly changed = output<void>();

  private readonly applications = inject(ApplicationService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  private readonly cache = inject(EvaluationCache);

  protected readonly i = { CircleCheck, CircleX, GraduationCap, Info, MessageCircle, RefreshCw, ShieldCheck, Sparkles, TriangleAlert };
  protected readonly initials = initials;
  protected readonly tone = scoreTone;
  protected readonly recTone = recommendationTone;

  protected readonly application = signal<Application | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly guide = signal<InterviewGuide | null>(null);
  protected readonly guideError = signal<string | null>(null);
  protected readonly evaluating = signal(false);
  protected readonly changing = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly tab = signal<'guide' | 'ai'>('guide');
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly evaluation = computed(() => this.cache.byApplication()[this.applicationId()] ?? null);
  protected readonly status = computed<ApplicationStatus>(() => this.application()?.status ?? this.item()?.status ?? 'new');

  constructor() {
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
    effect(() => {
      const id = this.applicationId();
      untracked(() => this.load(id));
    });
  }

  private load(id: number): void {
    this.application.set(null);
    this.guide.set(null);
    this.loadError.set(null);
    this.guideError.set(null);
    this.aiError.set(null);
    this.applications.get(id).subscribe({
      next: (a) => this.application.set(a),
      error: (e) => this.loadError.set(errorMessage(e)),
    });
    this.applications.interviewGuide(id).subscribe({
      next: (g) => this.guide.set(g),
      error: (e) => this.guideError.set(errorMessage(e)),
    });
  }

  protected next(status: ApplicationStatus): ApplicationStatus[] {
    return NEXT_STATUSES[status];
  }

  protected changeStatus(status: ApplicationStatus): void {
    const app = this.application();
    if (!app || status === app.status) return;
    this.changing.set(true);
    this.applications.setStatus(app.id, status).subscribe({
      next: (updated) => {
        this.changing.set(false);
        this.application.set(updated);
        this.toasts.ok(`Estado actualizado: ${statusLabel(status)}`);
        this.changed.emit();
      },
      error: (e) => {
        this.changing.set(false);
        this.toasts.error(errorMessage(e));
        // Put the select back on the real status
        this.application.set({ ...app });
      },
    });
  }

  protected evaluate(id: number): void {
    this.evaluating.set(true);
    this.aiError.set(null);
    this.ai.evaluate(id).subscribe({
      next: (ev) => {
        this.cache.set(ev);
        this.evaluating.set(false);
      },
      error: (e) => {
        this.aiError.set(errorMessage(e));
        this.evaluating.set(false);
      },
    });
  }
}
