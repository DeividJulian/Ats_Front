import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  GraduationCap,
  Lightbulb,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Sparkles,
  Timer,
  Trash2,
  User,
  UserPlus,
  X,
  Zap,
} from 'lucide-angular';

import { AiStatus, Area, Candidate, EducationLevel, ResumeAnalysis } from '../../../core/models';
import { AiService, CandidateService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { areaOf } from '../../../core/utils/areas';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { AREA_LABELS, EDUCATION_LEVELS, aiProviderLabel } from '../../../core/utils/labels';
import { canonicalizeSkills, normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { PdfDrop, pdfProblem } from '../../../shared/pdf-drop';

type AreaFilter = 'all' | Area;

@Component({
  selector: 'app-candidates',
  imports: [RouterLink, ReactiveFormsModule, LabelPipe, Icon, Modal, PdfDrop],
  templateUrl: './candidates.html',
  styleUrl: './candidates.css',
})
export class Candidates {
  private readonly api = inject(CandidateService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly i = {
    BrainCircuit, ChevronDown, ChevronUp, CloudUpload, GraduationCap, Lightbulb, Mail, Pencil, Phone, Plus, Save,
    Search, Sparkles, Timer, Trash2, User, UserPlus, X, Zap,
  };
  protected readonly levels = EDUCATION_LEVELS;
  protected readonly initials = initials;

  protected readonly candidates = signal<Candidate[]>([]);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly area = signal<AreaFilter>('all');
  protected readonly formOpen = signal(true);
  protected readonly extracting = signal<'text' | 'ai' | null>(null);
  protected readonly saving = signal(false);
  protected readonly skills = signal<string[]>([]);
  protected readonly newSkill = signal('');
  protected readonly aiSummary = signal<string | null>(null);
  protected readonly pdfOpen = signal(false);
  protected readonly reading = signal(false);
  protected readonly preview = signal<{ file: File; analysis: ResumeAnalysis } | null>(null);
  protected readonly uploadingFor = signal<number | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    resume_text: [''],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    experience_years: ['' as number | ''],
    education_level: ['' as EducationLevel | ''],
  });

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
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
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

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  /** Reads the pasted resume with the system's own NLP and fills the empty fields. */
  protected extract(): void {
    const text = this.form.controls.resume_text.value.trim();
    if (text.length < 20) {
      this.toasts.info('Pega primero el texto de la hoja de vida');
      return;
    }
    this.extracting.set('text');
    this.api.analyzeText(text).subscribe({
      next: (a) => {
        this.extracting.set(null);
        const f = this.form.controls;
        if (a.name && !f.name.value) f.name.setValue(a.name);
        if (a.email && !f.email.value) f.email.setValue(a.email);
        if (a.phone && !f.phone.value) f.phone.setValue(a.phone);
        if (a.experience_years) f.experience_years.setValue(a.experience_years);
        if (a.education_level) f.education_level.setValue(a.education_level);
        this.skills.set(canonicalizeSkills([...this.skills(), ...a.skills]));
        this.toasts.ok(`Perfil extraído: ${a.skills.length} habilidades detectadas`);
      },
      error: (e) => {
        this.extracting.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  /** Same, but the language model reads the resume (only when the server has an AI key). */
  protected extractWithAi(): void {
    const text = this.form.controls.resume_text.value.trim();
    if (text.length < 20) {
      this.toasts.info('Pega primero el texto de la hoja de vida');
      return;
    }
    this.extracting.set('ai');
    this.ai.extractResume(text).subscribe({
      next: (p) => {
        this.extracting.set(null);
        this.form.patchValue({ experience_years: p.experience_years || '', education_level: p.education_level ?? '' });
        this.skills.set(canonicalizeSkills([...this.skills(), ...p.skills]));
        this.aiSummary.set(p.summary || null);
        this.toasts.ok(`${aiProviderLabel(this.aiStatus()?.provider)} completó el perfil`);
      },
      error: (e) => {
        this.extracting.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected removeSkill(skill: string): void {
    this.skills.update((list) => list.filter((s) => s !== skill));
  }

  protected addSkill(): void {
    const value = this.newSkill().trim();
    if (!value) return;
    this.skills.set(canonicalizeSkills([...this.skills(), value]));
    this.newSkill.set('');
  }

  protected clear(): void {
    this.form.reset();
    this.skills.set([]);
    this.aiSummary.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .create({
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim() || null,
        resume_text: v.resume_text.trim(),
        skills: this.skills(),
        experience_years: v.experience_years === '' ? null : Number(v.experience_years),
        education_level: v.education_level || null,
      })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.clear();
          this.toasts.ok(`${c.name} quedó registrado con ${c.skills.length} habilidades`);
          this.candidates.update((list) => [...list, c]);
        },
        error: (e) => {
          this.saving.set(false);
          this.toasts.error(errorMessage(e));
        },
      });
  }

  /** PDF flow, first step: the server reads it and shows what it found, without saving. */
  protected analyzePdf(file: File): void {
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

  protected confirmPdf(): void {
    const current = this.preview();
    if (!current) return;
    this.reading.set(true);
    this.api.createFromResume(current.file).subscribe({
      next: (c) => {
        this.reading.set(false);
        this.pdfOpen.set(false);
        this.preview.set(null);
        this.toasts.ok(`${c.name} quedó registrado con ${c.skills.length} habilidades`);
        void this.router.navigate(['/app/candidatos', c.id]);
      },
      error: (e) => {
        this.reading.set(false);
        this.toasts.error(errorMessage(e));
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
