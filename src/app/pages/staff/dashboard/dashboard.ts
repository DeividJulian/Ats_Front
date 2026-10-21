import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Briefcase, ChartColumn, FileText, Info, Plus, RefreshCw, RotateCw, Sparkles, TriangleAlert, Users } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { AiStatus, Job, RankingItem, Stats } from '../../../core/models';
import { AiService, JobService, StatsService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { isThisMonth } from '../../../core/utils/areas';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { APPLICATION_STATUS_LABELS, PIPELINE, statusBadge } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { scoreTone } from '../../../shared/score-bar';

/** Coverage of a skill: share of candidates that have it. */
export function coverageLevel(pct: number): { label: string; kind: 'good' | 'warn' | 'bad' } {
  if (pct >= 50) return { label: `Cubierta ${pct}%`, kind: 'good' };
  if (pct >= 20) return { label: `Escasa ${pct}%`, kind: 'warn' };
  return { label: `Brecha ${pct}%`, kind: 'bad' };
}

/** Buenos días / tardes / noches by the hour. */
export function greetingFor(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function averageScore(perJob: { applications: number; average_score: number }[]): number {
  const total = perJob.reduce((sum, j) => sum + j.applications, 0);
  if (!total) return 0;
  return Math.round(perJob.reduce((sum, j) => sum + j.average_score * j.applications, 0) / total);
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, LabelPipe, Icon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly statsApi = inject(StatsService);
  private readonly jobsApi = inject(JobService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly i = { Briefcase, ChartColumn, FileText, Info, Plus, RefreshCw, RotateCw, Sparkles, TriangleAlert, Users };
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly statusBadge = statusBadge;
  protected readonly tone = scoreTone;

  protected readonly stats = signal<Stats | null>(null);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly topByJob = signal<Record<number, RankingItem[]>>({});
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly seeding = signal(false);
  protected readonly refreshing = signal(false);
  /** When the numbers on screen were read from the server. */
  protected readonly updatedAt = signal<Date | null>(null);
  protected readonly initials = initials;

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => greetingFor(new Date().getHours()));

  /** Average score of all applications, weighting each job by its number of applications. */
  protected readonly averageScore = computed(() => averageScore(this.stats()?.per_job ?? []));
  protected readonly averageTone = computed(() => {
    const avg = this.averageScore();
    return avg >= 75 ? 'alto' : avg >= 50 ? 'medio' : 'bajo';
  });

  /** Applicants of each job, as a share of the busiest one. */
  protected readonly byJob = computed(() => {
    const list = [...(this.stats()?.per_job ?? [])].sort((a, b) => b.applications - a.applications).slice(0, 6);
    const max = Math.max(1, ...list.map((j) => j.applications));
    return list.map((j) => ({ ...j, pct: Math.round((100 * j.applications) / max) }));
  });

  /** Best candidates of all jobs together. */
  protected readonly topCandidates = computed(() => {
    const titles = new Map((this.stats()?.per_job ?? []).map((p) => [p.job_id, p.title]));
    return Object.entries(this.topByJob())
      .flatMap(([jobId, items]) => items.map((c) => ({ ...c, job_id: Number(jobId), job_title: titles.get(Number(jobId)) ?? '' })))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  });

  protected readonly jobsThisMonth = computed(() => this.jobs().filter((j) => isThisMonth(j.created_at)).length);
  protected readonly perJob = computed(() => {
    const totals = this.stats()?.totals;
    return totals && totals.jobs ? Math.round((10 * totals.applications) / totals.jobs) / 10 : 0;
  });

  /** Steps of the funnel with their share of all applications. */
  protected readonly funnel = computed(() => {
    const funnel = this.stats()?.funnel ?? {};
    const total = this.stats()?.totals.applications ?? 0;
    return PIPELINE.map((status, index) => {
      const count = funnel[status] ?? 0;
      return { status, index: index + 1, label: APPLICATION_STATUS_LABELS[status], count, pct: total ? Math.round((1000 * count) / total) / 10 : 0 };
    });
  });
  protected readonly rejected = computed(() => {
    const count = this.stats()?.funnel['rejected'] ?? 0;
    const total = this.stats()?.totals.applications ?? 0;
    return { count, pct: total ? Math.round((1000 * count) / total) / 10 : 0 };
  });

  /** Demand vs availability: how many jobs ask for each skill and how many candidates have it. */
  protected readonly demand = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const candidates = s.totals.candidates;
    return s.most_demanded_skills.slice(0, 6).map((item) => {
      const pct = candidates ? Math.round((100 * item.candidates_with_skill) / candidates) : 0;
      return { ...item, pct, level: coverageLevel(pct) };
    });
  });

  protected readonly isEmpty = computed(() => {
    const totals = this.stats()?.totals;
    return !!totals && totals.jobs === 0 && totals.candidates === 0;
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
  }

  protected load(): void {
    this.error.set(null);
    this.refreshing.set(true);
    forkJoin({ stats: this.statsApi.get(), jobs: this.jobsApi.list() }).subscribe({
      next: ({ stats, jobs }) => {
        this.stats.set(stats);
        this.jobs.set(jobs);
        this.loading.set(false);
        this.refreshing.set(false);
        this.updatedAt.set(new Date());
        this.loadTopCandidates(stats);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
        this.refreshing.set(false);
      },
    });
  }

  /** Best candidates of each job, for the avatars of the job cards. */
  private loadTopCandidates(stats: Stats): void {
    const ids = stats.per_job.filter((p) => p.applications > 0).slice(0, 6).map((p) => p.job_id);
    if (!ids.length) return;
    forkJoin(Object.fromEntries(ids.map((id) => [id, this.jobsApi.ranking(id).pipe(catchError(() => of([])))]))).subscribe(
      (byId) => this.topByJob.set(byId as Record<number, RankingItem[]>),
    );
  }

  protected loadDemo(): void {
    this.seeding.set(true);
    this.statsApi.loadDemo(false).subscribe({
      next: () => {
        this.seeding.set(false);
        this.toasts.ok('Datos de demostración cargados');
        this.load();
      },
      error: (e) => {
        this.seeding.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
