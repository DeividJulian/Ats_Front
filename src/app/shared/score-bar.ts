import { Component, computed, input } from '@angular/core';

import { classificationLabel } from '../core/utils/labels';

/** Design class suffix of each classification: alto, medio, bajo. */
export function scoreTone(classification: string | null | undefined): 'alto' | 'medio' | 'bajo' {
  if (classification === 'high') return 'alto';
  if (classification === 'medium') return 'medio';
  return 'bajo';
}

/** Fit score (0-100) as a number, a colored bar and its classification. */
@Component({
  selector: 'app-score-bar',
  template: `
    <div class="score" [class]="'score--' + tone()">
      <div class="score__top">
        <span class="score__value">{{ score() }}<small> / 100</small></span>
        @if (showLabel()) {
          <span class="badge" [class]="'badge--' + tone()">{{ label() }}</span>
        }
      </div>
      <div class="score__track" role="img" [attr.aria-label]="'Ajuste ' + score() + ' de 100, ' + label()">
        <div class="score__fill" [style.width.%]="score()"></div>
      </div>
    </div>
  `,
  styles: `:host { display: block; min-width: 180px; }`,
})
export class ScoreBar {
  readonly score = input.required<number>();
  readonly classification = input.required<string>();
  readonly showLabel = input(true);
  protected readonly label = computed(() => classificationLabel(this.classification()));
  protected readonly tone = computed(() => scoreTone(this.classification()));
}
