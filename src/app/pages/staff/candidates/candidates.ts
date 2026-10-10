import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Candidate, ResumeAnalysis } from '../../../core/models';
import { CandidateService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { PdfDrop } from '../../../shared/pdf-drop';
import { CandidateForm } from './candidate-form';

@Component({
  selector: 'app-candidates',
  imports: [RouterLink, LabelPipe, Modal, PdfDrop, CandidateForm],
  templateUrl: './candidates.html',
  styles: `
    .search { max-width: 320px; }
    .avatar { width: 38px; height: 38px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: linear-gradient(135deg, var(--violet), var(--blue)); color: #fff; }
    .person { display: flex; align-items: center; gap: 12px; }
    .person a { color: var(--text); font-weight: 700; }
  `,
})
export class Candidates {
  private readonly api = inject(CandidateService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly creating = signal<'manual' | 'pdf' | null>(null);
  protected readonly reading = signal(false);
  protected readonly preview = signal<{ file: File; analysis: ResumeAnalysis } | null>(null);
  protected readonly initials = initials;

  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    if (!term) return this.candidates();
    return this.candidates().filter((c) => normalize(`${c.name} ${c.email} ${c.skills.join(' ')}`).includes(term));
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.candidates.set(list);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected openCreate(mode: 'manual' | 'pdf'): void {
    this.preview.set(null);
    this.creating.set(mode);
  }

  /** First step: the server reads the PDF and shows what it found, without saving anything. */
  protected analyze(file: File): void {
    this.reading.set(true);
    this.api.analyzeResume(file).subscribe({
      next: (analysis) => {
        this.reading.set(false);
        this.preview.set({ file, analysis });
      },
      error: (e) => {
        this.reading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  /** Second step: create the candidate from the same PDF. */
  protected confirmPdf(): void {
    const current = this.preview();
    if (!current) return;
    this.reading.set(true);
    this.api.createFromResume(current.file).subscribe({
      next: (c) => {
        this.reading.set(false);
        this.creating.set(null);
        this.toasts.ok(`${c.name} quedó registrado con ${c.skills.length} habilidades`);
        void this.router.navigate(['/app/candidatos', c.id]);
      },
      error: (e) => {
        this.reading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected created(c: Candidate): void {
    this.creating.set(null);
    void this.router.navigate(['/app/candidatos', c.id]);
  }

  protected remove(c: Candidate): void {
    if (!confirm(`¿Eliminar a ${c.name}? También se borrarán sus postulaciones.`)) return;
    this.api.remove(c.id).subscribe({
      next: () => {
        this.candidates.update((list) => list.filter((x) => x.id !== c.id));
        this.toasts.ok('Candidato eliminado');
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }
}
