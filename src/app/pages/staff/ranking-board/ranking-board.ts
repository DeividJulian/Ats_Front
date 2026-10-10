import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BrainCircuit,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  FileText,
  Link,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Trophy,
  TriangleAlert,
  UserPlus,
  UserX,
  Users,
} from 'lucide-angular';

import { AiEvaluation, AiStatus, ApplicationStatus, Candidate, Job, RankingItem, Suggestion } from '../../../core/models';
import { AiService, ApplicationService, CandidateService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { NEXT_STATUSES, statusLabel } from '../../../core/utils/labels';
import { TabSyncService } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { ApplicationReview } from '../job-detail/application-review';

/** The candidate list to link: those who have not applied yet, filtered by name or email. */
export function linkableCandidates(candidates: Candidate[], applied: Set<number>, term: string): Candidate[] {
  const t = term.trim().toLowerCase();
  return candidates
    .filter((c) => !applied.has(c.id))
    .filter((c) => !t || c.name.toLowerCase().includes(t) || c.email.toLowerCase().includes(t))
    .slice(0, 8);
}

@Component({
  selector: 'app-ranking-board',
  imports: [RouterLink, LabelPipe, Icon, Modal, ApplicationReview],
  templateUrl: './ranking-board.html',
  styleUrl: './ranking-board.css',
})
export class RankingBoard {
  readonly job = input.required<Job>();
  /** Tells the parent page that the ranking changed (to refresh its numbers). */
  readonly changed = output<void>();

  private readonly jobsApi = inject(JobService);
  private readonly applications = inject(ApplicationService);
  private readonly candidatesApi = inject(CandidateService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  private readonly sync = inject(TabSyncService);

  protected readonly i = {
    BrainCircuit, CircleCheck, CircleX, Eye, EyeOff, FileText, Link, Mail, MessageSquareText, ShieldCheck, Sparkles,
    Trophy, TriangleAlert, UserPlus, UserX, Users,
  };

  protected readonly ranking = signal<RankingItem[]>([]);
  protected readonly suggestions = signal<Suggestion[]>([]);
  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly blind = signal(false);
  protected readonly reviewing = signal<RankingItem | null>(null);
  protected readonly evaluations = signal<Record<number, AiEvaluation>>({});
  protected readonly evaluating = signal<number | null>(null);
  protected readonly linkTerm = signal('');
  protected readonly linkChoice = signal<Candidate | null>(null);
  protected readonly initials = initials;

  protected readonly appliedIds = computed(() => new Set(this.ranking().map((r) => r.candidate_id)));
  protected readonly linkOptions = computed(() => linkableCandidates(this.candidates(), this.appliedIds(), this.linkTerm()));
  protected readonly isOpen = computed(() => this.job().status === 'open');

  constructor() {
    // Reload when the job changes or another tab changes data
    effect(() => {
      this.job();
      this.sync.remoteChanges();
      untracked(() => this.load());
    });
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
    this.candidatesApi.list().subscribe({ next: (c) => this.candidates.set(c), error: () => this.candidates.set([]) });
  }

  load(): void {
    const id = this.job().id;
    this.jobsApi.ranking(id, this.blind()).subscribe({
      next: (r) => {
        this.ranking.set(r);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
    this.jobsApi.suggestedCandidates(id, 6).subscribe({ next: (s) => this.suggestions.set(s), error: () => this.suggestions.set([]) });
  }

  protected toggleBlind(): void {
    this.blind.update((b) => !b);
    this.load();
  }

  protected nextStatuses(status: ApplicationStatus): ApplicationStatus[] {
    return NEXT_STATUSES[status];
  }

  protected advance(item: RankingItem, status: ApplicationStatus): void {
    this.applications.setStatus(item.application_id, status).subscribe({
      next: () => {
        this.toasts.ok(`${this.blind() ? `Candidato ${item.position}` : item.name}: ${statusLabel(status)}`);
        this.load();
        this.changed.emit();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected withdraw(item: RankingItem): void {
    if (!confirm('¿Retirar esta postulación de la vacante?')) return;
    this.applications.withdraw(item.application_id).subscribe({
      next: () => {
        this.toasts.ok('Postulación retirada');
        this.load();
        this.changed.emit();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected evaluate(item: RankingItem): void {
    if (this.evaluations()[item.application_id]) {
      // Second click hides the evaluation
      this.evaluations.update(({ [item.application_id]: _, ...rest }) => rest);
      return;
    }
    this.evaluating.set(item.application_id);
    this.ai.evaluate(item.application_id).subscribe({
      next: (ev) => {
        this.evaluating.set(null);
        this.evaluations.update((all) => ({ ...all, [item.application_id]: ev }));
      },
      error: (e) => {
        this.evaluating.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected apply(candidateId: number, name: string): void {
    this.applications.apply(this.job().id, candidateId).subscribe({
      next: (a) => {
        this.toasts.ok(`${name} quedó postulado con ${a.score} puntos`);
        this.linkTerm.set('');
        this.linkChoice.set(null);
        this.load();
        this.changed.emit();
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected choose(candidate: Candidate): void {
    this.linkChoice.set(candidate);
    this.linkTerm.set(candidate.name);
  }

  protected link(): void {
    const chosen = this.linkChoice();
    if (chosen) this.apply(chosen.id, chosen.name);
  }
}
