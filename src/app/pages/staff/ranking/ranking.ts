import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EyeOff, ListOrdered, Sparkles, TriangleAlert } from 'lucide-angular';
import { forkJoin, from, of } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';

import { AiStatus, Application, Job, RankingItem } from '../../../core/models';
import { AiService, ApplicationService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { statusBadge } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';
import { EvaluationCache, recommendationTone } from '../job-detail/application-review';

/** Columns of the comparison, in the order the score explains itself. */
export const BREAKDOWN_COLUMNS = ['skills', 'experience', 'education', 'text'] as const;

/** Short names for the table headers. */
export const COLUMN_LABELS: Record<(typeof BREAKDOWN_COLUMNS)[number], string> = {
  skills: 'Habilidades',
  experience: 'Experiencia',
  education: 'Educación',
  text: 'Similitud',
};

/** How many of the best candidates "Evaluar con IA" sends, one by one. */
export const AI_BATCH = 5;

/** Ranking of any job: the best three side by side and the full comparison below. */
@Component({
  selector: 'app-ranking',
  imports: [RouterLink, LabelPipe, Icon],
  templateUrl: './ranking.html',
  styles: `
    .picker { min-width: 280px; }
    .podium .step-card__num { flex: none; }
    .first { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent), var(--shadow-1); }
    .user-link { text-decoration: none; color: inherit; }
    .user-link:hover .t-strong { color: var(--c-primary); }
    .table .avatar { flex: none; }
  `,
})
export class Ranking implements OnInit {
  /** Query parameter ?vacante=ID to open a job directly */
  readonly vacante = input<string>();

  private readonly jobsApi = inject(JobService);
  private readonly applicationsApi = inject(ApplicationService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly cache = inject(EvaluationCache);

  protected readonly i = { EyeOff, ListOrdered, Sparkles, TriangleAlert };
  protected readonly columns = BREAKDOWN_COLUMNS;
  protected readonly batch = AI_BATCH;
  protected readonly columnLabels = COLUMN_LABELS;
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly initials = initials;
  protected readonly statusBadge = statusBadge;
  protected readonly tone = scoreTone;
  protected readonly recTone = recommendationTone;

  protected readonly jobs = signal<Job[]>([]);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly ranking = signal<RankingItem[]>([]);
  protected readonly details = signal<Record<number, Application>>({});
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly blind = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingRanking = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Application being evaluated right now by the batch. */
  protected readonly evaluatingId = signal<number | null>(null);
  protected readonly batchRunning = signal(false);

  protected readonly selected = computed(() => this.jobs().find((j) => j.id === this.selectedId()) ?? null);
  protected readonly podium = computed(() => this.ranking().slice(0, 3));
  protected readonly evaluations = this.cache.byApplication;

  constructor() {
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
    reloadOnRemoteChanges(() => this.loadRanking());
  }

  ngOnInit(): void {
    this.jobsApi.list().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
        const wanted = Number(this.vacante());
        const initial = jobs.find((j) => j.id === wanted) ?? jobs.find((j) => j.status === 'open') ?? jobs[0];
        this.selectedId.set(initial?.id ?? null);
        this.loadRanking();
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
    this.loadRanking();
  }

  protected toggleBlind(): void {
    this.blind.update((b) => !b);
    this.loadRanking();
  }

  protected loadRanking(): void {
    const id = this.selectedId();
    if (id === null) return;
    this.loadingRanking.set(true);
    this.jobsApi.ranking(id, this.blind()).subscribe({
      next: (items) => {
        this.ranking.set(items);
        this.loadingRanking.set(false);
        this.loadDetails(items);
      },
      error: (e) => {
        this.loadingRanking.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  /** Each application brings its score breakdown for the comparison columns. */
  private loadDetails(items: RankingItem[]): void {
    const missing = items.filter((r) => !this.details()[r.application_id]);
    if (!missing.length) return;
    forkJoin(missing.map((r) => this.applicationsApi.get(r.application_id).pipe(catchError(() => of(null))))).subscribe((apps) => {
      const found = Object.fromEntries(apps.filter((a): a is Application => !!a).map((a) => [a.id, a]));
      this.details.update((all) => ({ ...all, ...found }));
    });
  }

  protected part(applicationId: number, key: string): number | null {
    return this.details()[applicationId]?.details.breakdown[key] ?? null;
  }

  /** Sends the best candidates without an evaluation to the AI, one at a time. */
  protected evaluateTop(): void {
    const pending = this.ranking().slice(0, AI_BATCH).filter((r) => !this.evaluations()[r.application_id]);
    if (!pending.length) {
      this.toasts.info(`Los ${Math.min(AI_BATCH, this.ranking().length)} mejores ya tienen evaluación`);
      return;
    }
    this.batchRunning.set(true);
    let failures = 0;
    from(pending)
      .pipe(
        concatMap((r) => {
          this.evaluatingId.set(r.application_id);
          return this.ai.evaluate(r.application_id).pipe(
            catchError((e) => {
              failures++;
              if (failures === 1) this.toasts.error(errorMessage(e));
              return of(null);
            }),
          );
        }),
      )
      .subscribe({
        next: (ev) => {
          if (ev) this.cache.set(ev);
        },
        complete: () => {
          this.evaluatingId.set(null);
          this.batchRunning.set(false);
          const done = pending.length - failures;
          if (done) this.toasts.ok(`IA: ${done} ${done === 1 ? 'candidato evaluado' : 'candidatos evaluados'}`);
        },
      });
  }
}
