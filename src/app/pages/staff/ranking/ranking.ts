import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Trophy } from 'lucide-angular';

import { Job } from '../../../core/models';
import { JobService } from '../../../core/services/api.services';
import { errorMessage } from '../../../core/utils/http-error';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { RankingBoard } from '../ranking-board/ranking-board';

/** Ranking of any job: choose it at the top and work with its candidates below. */
@Component({
  selector: 'app-ranking',
  imports: [RouterLink, LabelPipe, Icon, RankingBoard],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>Ranking de candidatos</h1>
          <p class="subtle">Elige una vacante y decide con el puntaje explicable.</p>
        </div>
      </div>

      @if (error()) {
        <div class="empty"><strong>{{ error() }}</strong></div>
      } @else if (jobs().length === 0 && !loading()) {
        <div class="empty">
          <span class="icon-tile"><app-icon [icon]="trophy" [size]="24" /></span>
          <strong>Todavía no hay vacantes</strong>
          <a class="btn primary small" routerLink="/app/vacantes/nueva">Crear vacante</a>
        </div>
      } @else {
        <div class="card picker">
          <span class="icon-tile"><app-icon [icon]="trophy" [size]="20" /></span>
          <label class="grow">
            Vacante
            <select (change)="choose(+$any($event.target).value)">
              @for (job of jobs(); track job.id) {
                <option [value]="job.id" [selected]="job.id === selected()?.id">{{ job.title }} · {{ job.status | label: 'jobStatus' }}</option>
              }
            </select>
          </label>
        </div>
        @if (selected(); as job) {
          <app-ranking-board [job]="job" />
        }
      }
    </div>
  `,
  styles: `
    .narrow { max-width: 860px; }
    .picker { display: flex; align-items: flex-end; gap: 14px; }
    .grow { flex: 1; }
  `,
})
export class Ranking implements OnInit {
  /** Query parameter ?vacante=ID to open a job directly */
  readonly vacante = input<string>();

  private readonly jobsApi = inject(JobService);
  private readonly router = inject(Router);

  protected readonly trophy = Trophy;
  protected readonly jobs = signal<Job[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = computed(() => this.jobs().find((j) => j.id === this.selectedId()) ?? null);

  ngOnInit(): void {
    this.jobsApi.list().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
        const wanted = Number(this.vacante());
        const initial = jobs.find((j) => j.id === wanted) ?? jobs.find((j) => j.status === 'open') ?? jobs[0];
        this.selectedId.set(initial?.id ?? null);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected choose(id: number): void {
    this.selectedId.set(id);
    void this.router.navigate([], { queryParams: { vacante: id }, replaceUrl: true });
  }
}
