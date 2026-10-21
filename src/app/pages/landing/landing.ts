import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ArrowRight,
  Briefcase,
  Building2,
  ChartColumn,
  Check,
  CloudOff,
  FileText,
  GraduationCap,
  MessageCircle,
  Search,
  SearchX,
  ShieldCheck,
  Sparkles,
  Target,
  User,
} from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { AuthService, homeFor } from '../../core/auth/auth.service';
import { PublicJob, PublicSummary } from '../../core/models';
import { PublicService } from '../../core/services/api.services';
import { errorMessage } from '../../core/utils/http-error';
import { normalize } from '../../core/workers/cv-analysis.logic';
import { PublicHeader } from '../../layout/public-header';
import { AgoPipe } from '../../shared/ago.pipe';
import { Icon } from '../../shared/icon';
import { LabelPipe } from '../../shared/label.pipe';
import { YearsPipe } from '../../shared/years.pipe';

/** "3 vacantes abiertas", or how many matched the search. */
export function jobCountLabel(total: number, shown: number, searching: boolean): string {
  const word = (n: number) => (n === 1 ? 'vacante' : 'vacantes');
  if (searching) return `${shown} de ${total} ${word(total)} coinciden con tu búsqueda`;
  return total === 1 ? '1 vacante abierta' : `${total} vacantes abiertas`;
}

/** Ranking shown in the hero, to explain the product at a glance. */
export const SAMPLE_RANKING = [
  { name: 'Laura Valentina Gómez', initials: 'LG', score: 88, tone: 'alto' },
  { name: 'Andrés Felipe Rojas', initials: 'AR', score: 76, tone: 'alto' },
  { name: 'María Camila Ortiz', initials: 'MO', score: 64, tone: 'medio' },
  { name: 'Juan David Martínez', initials: 'JM', score: 41, tone: 'bajo' },
];

@Component({
  selector: 'app-landing',
  imports: [RouterLink, PublicHeader, LabelPipe, AgoPipe, Icon, YearsPipe],
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
  protected readonly avatarTones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly i = {
    ArrowRight, Briefcase, Building2, ChartColumn, Check, CloudOff, FileText, GraduationCap, MessageCircle,
    Search, SearchX, ShieldCheck, Sparkles, Target, User,
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
  protected readonly countLabel = computed(() =>
    jobCountLabel(this.jobs().length, this.visibleJobs().length, this.search().trim().length > 0),
  );

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
