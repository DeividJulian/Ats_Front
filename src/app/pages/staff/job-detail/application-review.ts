import { Component, inject, input, OnInit, signal } from '@angular/core';
import { KeyValuePipe } from '@angular/common';

import { AiEvaluation, Application, InterviewGuide } from '../../../core/models';
import { AiService, ApplicationService } from '../../../core/services/api.services';
import { errorMessage } from '../../../core/utils/http-error';
import { LabelPipe } from '../../../shared/label.pipe';
import { ScoreBar } from '../../../shared/score-bar';

/** Everything about one application: score breakdown, explanation, interview guide and AI evaluation. */
@Component({
  selector: 'app-application-review',
  imports: [ScoreBar, LabelPipe, KeyValuePipe],
  template: `
    @if (application(); as app) {
      <div class="stack">
        <app-score-bar [score]="app.score" [classification]="app.details.classification" />

        <div class="grid cols-2">
          <div class="stack">
            <h3>Desglose del puntaje</h3>
            @for (item of app.details.breakdown | keyvalue; track item.key) {
              <div class="breakdown">
                <span class="small">{{ item.key | label: 'breakdown' }}</span>
                <div class="bar"><span [class.high]="item.value >= 75" [class.medium]="item.value >= 50 && item.value < 75" [class.low]="item.value < 50" [style.width.%]="item.value"></span></div>
                <strong class="small">{{ item.value }}%</strong>
              </div>
            }
          </div>
          <div class="stack">
            <h3>Por qué este puntaje</h3>
            <ul class="explanation small">
              @for (line of app.details.explanation; track $index) { <li>{{ line }}</li> }
            </ul>
          </div>
        </div>

        <div class="tabs">
          <button type="button" [class.active]="tab() === 'guide'" (click)="tab.set('guide')">Guía de entrevista</button>
          <button type="button" [class.active]="tab() === 'ai'" (click)="tab.set('ai')">Evaluación con IA</button>
        </div>

        @if (tab() === 'guide') {
          @if (guide(); as g) {
            <div class="notice">{{ g.focus }}</div>
            <ol class="questions">
              @for (q of g.questions; track $index) {
                <li><span class="badge">{{ q.type | label: 'questionType' }}</span> {{ q.question }}</li>
              }
            </ol>
            @if (g.training_for_gaps.length) {
              <h3>Si lo contratas, formación sugerida</h3>
              <ul class="small subtle">
                @for (t of g.training_for_gaps; track t.skill) { <li><strong>{{ t.skill }}:</strong> {{ t.suggestion }}</li> }
              </ul>
            }
          } @else if (guideError()) {
            <div class="notice error">{{ guideError() }}</div>
          } @else {
            <div class="stack"><div class="skeleton"></div><div class="skeleton"></div></div>
          }
        } @else {
          @if (evaluation(); as ev) {
            <div class="ai-box notice ai">
              <div class="row"><strong>Recomendación:</strong> <span class="badge" [class.high]="ev.recommendation === 'advance'" [class.medium]="ev.recommendation === 'interview_with_reservations'" [class.low]="ev.recommendation === 'reject'">{{ ev.recommendation | label: 'recommendation' }}</span></div>
              <p>{{ ev.summary }}</p>
              <div class="grid cols-2">
                <div><strong>Fortalezas</strong><ul>@for (s of ev.strengths; track $index) { <li>{{ s }}</li> }</ul></div>
                <div><strong>Brechas</strong><ul>@for (s of ev.gaps; track $index) { <li>{{ s }}</li> }</ul></div>
              </div>
              <strong>Preguntas sugeridas</strong>
              <ul>@for (q of ev.interview_questions; track $index) { <li>{{ q }}</li> }</ul>
              <span class="hint">La IA asesora; el puntaje del sistema ({{ ev.system_score }}) no cambia.</span>
            </div>
          } @else {
            <div class="stack">
              <p class="subtle small">Claude lee la vacante y la hoja de vida (sin nombre ni correo) y redacta un análisis. Puede tardar unos segundos.</p>
              @if (aiError()) { <div class="notice error">{{ aiError() }}</div> }
              <button type="button" class="btn ai" [disabled]="evaluating()" (click)="evaluate(app.id)">
                @if (evaluating()) { <span class="spinner"></span> Analizando… } @else { ✨ Evaluar con IA }
              </button>
            </div>
          }
        }
      </div>
    } @else {
      <div class="stack"><div class="skeleton"></div><div class="skeleton"></div></div>
    }
  `,
  styles: `
    .breakdown { display: grid; grid-template-columns: 130px 1fr 48px; align-items: center; gap: 10px; }
    .explanation, .questions { padding-left: 20px; display: grid; gap: 6px; }
    .questions li { line-height: 1.6; }
    .questions .badge { margin-right: 6px; }
  `,
})
export class ApplicationReview implements OnInit {
  readonly applicationId = input.required<number>();

  private readonly applications = inject(ApplicationService);
  private readonly ai = inject(AiService);

  protected readonly application = signal<Application | null>(null);
  protected readonly guide = signal<InterviewGuide | null>(null);
  protected readonly guideError = signal<string | null>(null);
  protected readonly evaluation = signal<AiEvaluation | null>(null);
  protected readonly evaluating = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly tab = signal<'guide' | 'ai'>('guide');

  ngOnInit(): void {
    const id = this.applicationId();
    this.applications.get(id).subscribe((a) => this.application.set(a));
    this.applications.interviewGuide(id).subscribe({
      next: (g) => this.guide.set(g),
      error: (e) => this.guideError.set(errorMessage(e)),
    });
  }

  protected evaluate(id: number): void {
    this.evaluating.set(true);
    this.aiError.set(null);
    this.ai.evaluate(id).subscribe({
      next: (ev) => {
        this.evaluation.set(ev);
        this.evaluating.set(false);
      },
      error: (e) => {
        this.aiError.set(errorMessage(e));
        this.evaluating.set(false);
      },
    });
  }
}
