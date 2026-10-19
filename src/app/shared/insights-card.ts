import { KeyValuePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Compass, TrendingUp } from 'lucide-angular';

import { CandidateInsights } from '../core/models';
import { Icon } from './icon';
import { LabelPipe } from './label.pipe';

/** Generated profile analysis: summary, skills by area, inferred skills and what to learn next. */
@Component({
  selector: 'app-insights-card',
  imports: [LabelPipe, KeyValuePipe, Icon],
  template: `
    @if (insights(); as i) {
      <section class="card stack">
        <div class="card__head" style="margin-bottom: 0">
          <h2 class="card__title"><app-icon class="t-primary" [icon]="icons.Compass" [size]="20" />{{ title() }}</h2>
          <span class="badge badge--candidato">{{ i.main_area | label: 'area' }}</span>
        </div>
        <p class="t-small">{{ i.summary }}</p>

        @for (group of i.skills_by_area | keyvalue; track group.key) {
          <div class="stack stack--sm">
            <span class="t-label">{{ group.key | label: 'area' }}</span>
            <div class="chips">@for (s of group.value; track s) { <span class="chip">{{ s }}</span> }</div>
          </div>
        }

        @if ((i.inferred_skills | keyvalue).length) {
          <div class="stack stack--sm">
            <span class="t-label">También domina, por inferencia</span>
            <div class="chips">
              @for (s of i.inferred_skills | keyvalue; track s.key) { <span class="chip chip--peach" [title]="'Inferida a partir de ' + s.value">{{ s.key }}</span> }
            </div>
          </div>
        }

        @if (i.skills_to_develop.length) {
          <div class="divider"></div>
          <h3 class="t-h3 row" style="gap: 8px"><app-icon class="t-primary" [icon]="icons.TrendingUp" [size]="18" />Qué conviene aprender</h3>
          <p class="t-small t-muted">Habilidades que piden las vacantes abiertas y que no aparecen en el perfil.</p>
          <ul class="list develop">
            @for (s of i.skills_to_develop; track s.skill) {
              <li class="list__item">
                <div class="list__main">
                  <div class="list__title">{{ s.skill }}</div>
                  <div class="list__sub">{{ s.suggestion }}</div>
                </div>
                <span class="badge">{{ s.open_jobs_requiring }} {{ s.open_jobs_requiring === 1 ? 'vacante' : 'vacantes' }}</span>
              </li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `.develop .list__title { white-space: normal; }`,
})
export class InsightsCard {
  readonly insights = input<CandidateInsights | null>(null);
  readonly title = input('Análisis del perfil');
  protected readonly icons = { Compass, TrendingUp };
}
