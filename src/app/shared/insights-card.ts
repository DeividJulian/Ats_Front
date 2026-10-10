import { KeyValuePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { CandidateInsights } from '../core/models';
import { LabelPipe } from './label.pipe';

/** Generated profile analysis: summary, skills by area, inferred skills and what to learn next. */
@Component({
  selector: 'app-insights-card',
  imports: [LabelPipe, KeyValuePipe],
  template: `
    @if (insights(); as i) {
      <div class="card stack">
        <div class="row">
          <h2>🧭 {{ title() }}</h2>
          <span class="spacer"></span>
          <span class="badge new">{{ i.main_area | label: 'area' }}</span>
        </div>
        <p>{{ i.summary }}</p>

        @for (group of i.skills_by_area | keyvalue; track group.key) {
          <div class="stack" style="gap: 6px">
            <span class="small subtle">{{ group.key | label: 'area' }}</span>
            <div class="chips">@for (s of group.value; track s) { <span class="chip">{{ s }}</span> }</div>
          </div>
        }

        @if ((i.inferred_skills | keyvalue).length) {
          <div class="stack" style="gap: 6px">
            <span class="small subtle">También domina, por inferencia</span>
            <div class="chips">
              @for (s of i.inferred_skills | keyvalue; track s.key) { <span class="chip warn" [title]="'Inferida a partir de ' + s.value">{{ s.key }}</span> }
            </div>
          </div>
        }

        @if (i.skills_to_develop.length) {
          <h3>📈 Qué conviene aprender</h3>
          <p class="small subtle">Habilidades que piden las vacantes abiertas y que no aparecen en el perfil.</p>
          <ul class="develop">
            @for (s of i.skills_to_develop; track s.skill) {
              <li>
                <div class="row"><strong>{{ s.skill }}</strong><span class="badge">{{ s.open_jobs_requiring }} {{ s.open_jobs_requiring === 1 ? 'vacante' : 'vacantes' }}</span></div>
                <span class="small subtle">{{ s.suggestion }}</span>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    .develop { list-style: none; padding: 0; display: grid; gap: 10px; }
    .develop li { display: grid; gap: 2px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); }
  `,
})
export class InsightsCard {
  readonly insights = input<CandidateInsights | null>(null);
  readonly title = input('Análisis del perfil');
}
