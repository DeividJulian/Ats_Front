import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { AiStatus, Stats } from '../../../core/models';
import { AiService, StatsService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { APPLICATION_STATUS_LABELS, PIPELINE } from '../../../core/utils/labels';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LabelPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly statsApi = inject(StatsService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly stats = signal<Stats | null>(null);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly seeding = signal(false);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');

  /** Funnel steps with their share of the largest one, to draw the bars. */
  protected readonly funnel = computed(() => {
    const funnel = this.stats()?.funnel ?? {};
    const steps = [...PIPELINE, 'rejected' as const].map((status) => ({
      status,
      label: APPLICATION_STATUS_LABELS[status],
      count: funnel[status] ?? 0,
    }));
    const max = Math.max(1, ...steps.map((s) => s.count));
    return steps.map((s) => ({ ...s, pct: Math.round((100 * s.count) / max) }));
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
    this.statsApi.get().subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
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

  /** Share of the candidates that have a skill, compared with how many jobs ask for it. */
  protected coverage(candidates: number): number {
    const total = this.stats()?.totals.candidates ?? 0;
    return total ? Math.round((100 * candidates) / total) : 0;
  }
}
