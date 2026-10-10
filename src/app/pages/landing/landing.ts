import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Target,
  Timer,
  WifiOff,
  BrainCircuit,
  SearchX,
} from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { AuthService, homeFor } from '../../core/auth/auth.service';
import { PublicJob, PublicSummary } from '../../core/models';
import { PublicService } from '../../core/services/api.services';
import { errorMessage } from '../../core/utils/http-error';
import { normalize } from '../../core/workers/cv-analysis.logic';
import { PublicHeader } from '../../layout/public-header';
import { Icon } from '../../shared/icon';
import { LabelPipe } from '../../shared/label.pipe';

/** Ranking shown in the hero, to explain the product at a glance. */
export const SAMPLE_RANKING = [
  { name: 'Camila O.', score: 92.9, classification: 'high', skills: ['python', 'fastapi', 'docker'] },
  { name: 'Sebastián R.', score: 53.3, classification: 'medium', skills: ['django', 'git'] },
  { name: 'Valentina C.', score: 29.1, classification: 'low', skills: ['java', 'sql'] },
];

@Component({
  selector: 'app-landing',
  imports: [RouterLink, PublicHeader, LabelPipe, Icon],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing implements OnInit {
  private readonly publicApi = inject(PublicService);
  protected readonly auth = inject(AuthService);

  protected readonly jobs = signal<PublicJob[]>([]);
  protected readonly summary = signal<PublicSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly sample = SAMPLE_RANKING;
  protected readonly i = {
    ArrowRight, Building2, GraduationCap, Rocket, Scale, Search, Sparkles, Target, Timer,
    WifiOff, BrainCircuit, SearchX,
  };

  /** Jobs whose title, description or skills contain the search text (accents ignored). */
  protected readonly visibleJobs = computed(() => {
    const term = normalize(this.search().trim());
    if (!term) return this.jobs();
    return this.jobs().filter((job) =>
      normalize(`${job.title} ${job.description} ${job.required_skills.join(' ')}`).includes(term),
    );
  });

  protected readonly home = computed(() => homeFor(this.auth.role()));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ jobs: this.publicApi.jobs(), summary: this.publicApi.summary() }).subscribe({
      next: ({ jobs, summary }) => {
        this.jobs.set(jobs);
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
