import { Component, computed, input } from '@angular/core';

import { classificationLabel } from '../core/utils/labels';

/** Fit score (0-100) as a number, a colored bar and its classification. */
@Component({
  selector: 'app-score-bar',
  template: `
    <div class="score" [attr.aria-label]="'Ajuste ' + score() + ' de 100, ' + label()">
      <strong>{{ score() }}</strong>
      <div class="bar"><span [class]="classification()" [style.width.%]="score()"></span></div>
      @if (showLabel()) {
        <span class="badge" [class]="classification()">{{ label() }}</span>
      }
    </div>
  `,
  styles: `
    .score { display: flex; align-items: center; gap: 10px; min-width: 180px; }
    strong { font-variant-numeric: tabular-nums; width: 38px; text-align: right; }
    .bar { flex: 1; }
  `,
})
export class ScoreBar {
  readonly score = input.required<number>();
  readonly classification = input.required<string>();
  readonly showLabel = input(true);
  protected readonly label = computed(() => classificationLabel(this.classification()));
}
