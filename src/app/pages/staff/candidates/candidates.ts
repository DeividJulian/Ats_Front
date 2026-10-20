import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CloudOff, CloudUpload, FileCheck, Files, Search, SearchX, Trash2, UserPlus } from 'lucide-angular';

import { Area, Candidate } from '../../../core/models';
import { CandidateService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { AREA_LABELS } from '../../../core/utils/labels';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { pdfProblem } from '../../../shared/pdf-drop';

type AreaFilter = 'all' | Area;

/** Talent bank: search, filter by area, upload resumes and open each profile. */
@Component({
  selector: 'app-candidates',
  imports: [RouterLink, LabelPipe, Icon],
  templateUrl: './candidates.html',
  styleUrl: './candidates.css',
})
export class Candidates {
  private readonly api = inject(CandidateService);
  private readonly toasts = inject(ToastService);

  protected readonly i = { CloudOff, CloudUpload, FileCheck, Files, Search, SearchX, Trash2, UserPlus };
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly initials = initials;

  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly area = signal<AreaFilter>('all');
  protected readonly uploadingFor = signal<number | null>(null);

  /** Each candidate with its professional area, computed from the skills. */
  protected readonly withArea = computed(() => this.candidates().map((c) => ({ c, area: areaOf(c.skills) })));

  protected readonly areaFilters = computed(() => {
    const counts = new Map<Area, number>();
    for (const { area } of this.withArea()) counts.set(area, (counts.get(area) ?? 0) + 1);
    const areas = (Object.keys(AREA_LABELS) as Area[]).filter((a) => counts.has(a));
    return [
      { value: 'all' as AreaFilter, label: 'Todos', count: this.candidates().length },
      ...areas.map((a) => ({ value: a as AreaFilter, label: AREA_LABELS[a], count: counts.get(a) ?? 0 })),
    ];
  });

  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    return this.withArea().filter(
      ({ c, area }) =>
        (this.area() === 'all' || area === this.area()) &&
        (!term || normalize(`${c.name} ${c.email} ${c.skills.join(' ')}`).includes(term)),
    );
  });

  protected readonly withResume = computed(() => this.candidates().filter((c) => c.resume_text.trim()).length);

  constructor() {
    reloadOnRemoteChanges(() => this.load());
  }

  protected load(): void {
    this.error.set(null);
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

  /** Upload or replace the resume of a candidate from its card. */
  protected uploadFor(candidate: Candidate, event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    field.value = '';
    if (!file) return;
    const problem = pdfProblem(file);
    if (problem) {
      this.toasts.error(problem);
      return;
    }
    this.uploadingFor.set(candidate.id);
    this.api.uploadResume(candidate.id, file).subscribe({
      next: (updated) => {
        this.uploadingFor.set(null);
        this.candidates.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
        this.toasts.ok(`Hoja de vida de ${updated.name} leída: ${updated.skills.length} habilidades`);
      },
      error: (e) => {
        this.uploadingFor.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
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
