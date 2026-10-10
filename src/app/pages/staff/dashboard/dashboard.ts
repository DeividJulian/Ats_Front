import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Briefcase,
  ChartColumn,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  Flag,
  Funnel,
  MapPin,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
  Trophy,
  Users,
  CircleX,
} from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { AiStatus, Job, RankingItem, Stats } from '../../../core/models';
import { AiService, JobService, StatsService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf, isThisMonth } from '../../../core/utils/areas';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { APPLICATION_STATUS_LABELS, PIPELINE } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';

/** Coverage of a skill: share of candidates that have it. */
export function coverageLevel(pct: number): { label: string; kind: 'good' | 'warn' | 'bad' } {
  if (pct >= 50) return { label: `Cubierta ${pct}%`, kind: 'good' };
  if (pct >= 20) return { label: `Escasa ${pct}%`, kind: 'warn' };
  return { label: `Brecha ${pct}%`, kind: 'bad' };
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LabelPipe, Icon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly statsApi = inject(StatsService);
  private readonly jobsApi = inject(JobService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly i = {
    Briefcase, ChartColumn, ChevronRight, CircleCheck, ClipboardList, Flag, Funnel, MapPin, RefreshCw,
    Sparkles, Target, TriangleAlert, Trophy, Users, CircleX,
  };

  protected readonly stats = signal<Stats | null>(null);
  protected readonly jobs = signal<Job[]>([]);
  protected readonly topByJob = signal<Record<number, RankingItem[]>>({});
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly seeding = signal(false);
  protected readonly initials = initials;

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

  /** Job cards: the job, its numbers and its area. */
  protected readonly jobCards = computed(() => {
    const byId = new Map(this.jobs().map((j) => [j.id, j]));
    return (this.stats()?.per_job ?? []).slice(0, 6).map((p) => {
      const job = byId.get(p.job_id);
      return { ...p, area: areaOf(job?.required_skills ?? []), top: this.topByJob()[p.job_id] ?? [] };
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
    forkJoin({ stats: this.statsApi.get(), jobs: this.jobsApi.list() }).subscribe({
      next: ({ stats, jobs }) => {
        this.stats.set(stats);
        this.jobs.set(jobs);
        this.loading.set(false);
        this.loadTopCandidates(stats);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
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
