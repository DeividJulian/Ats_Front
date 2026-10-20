import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChevronRight, CircleAlert, CloudUpload, FileText, Info, Lock, Plus, Sparkles, X } from 'lucide-angular';

import { AiStatus, EducationLevel, ResumeAnalysis } from '../../../core/models';
import { AiService, CandidateService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EDUCATION_LEVELS, aiProviderLabel } from '../../../core/utils/labels';
import { canonicalizeSkills } from '../../../core/workers/cv-analysis.logic';
import { Icon } from '../../../shared/icon';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';
import { PdfDrop } from '../../../shared/pdf-drop';

/** Register a candidate: paste the resume, extract the profile (own NLP or AI), review and save. */
@Component({
  selector: 'app-candidate-new',
  imports: [ReactiveFormsModule, RouterLink, LabelPipe, Icon, Modal, PdfDrop],
  templateUrl: './candidate-new.html',
  styles: `
    .cv { min-height: 280px; font-size: 14px; }
    .side { position: sticky; top: 92px; }
    @media (max-width: 1100px) { .side { position: static; } }
  `,
})
export class CandidateNew {
  private readonly api = inject(CandidateService);
  private readonly ai = inject(AiService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly i = { ChevronRight, CircleAlert, CloudUpload, FileText, Info, Lock, Plus, Sparkles, X };
  protected readonly levels = EDUCATION_LEVELS;
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly extracting = signal<'text' | 'ai' | null>(null);
  /** Who filled the profile last: the system's NLP or the AI. */
  protected readonly extractedBy = signal<'system' | 'ai' | null>(null);
  protected readonly saving = signal(false);
  protected readonly tried = signal(false);
  protected readonly skills = signal<string[]>([]);
  /** Skills the AI added on top of the ones the system found. */
  protected readonly aiSkills = signal<string[]>([]);
  protected readonly newSkill = signal('');
  protected readonly aiSummary = signal<string | null>(null);
  protected readonly pdfOpen = signal(false);
  protected readonly reading = signal(false);
  protected readonly preview = signal<{ file: File; analysis: ResumeAnalysis } | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    resume_text: [''],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    experience_years: ['' as number | ''],
    education_level: ['' as EducationLevel | ''],
  });

  private readonly resume = toSignal(this.form.controls.resume_text.valueChanges, { initialValue: '' });
  protected readonly resumeLength = computed(() => this.resume().trim().length);

  constructor() {
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return (control.touched || this.tried()) && control.invalid;
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
        this.extractedBy.set('system');
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
        this.extractedBy.set('ai');
        this.form.patchValue({ experience_years: p.experience_years || '', education_level: p.education_level ?? '' });
        const before = new Set(this.skills());
        const merged = canonicalizeSkills([...this.skills(), ...p.skills]);
        this.aiSkills.set(merged.filter((s) => !before.has(s)));
        this.skills.set(merged);
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

  protected save(): void {
    this.tried.set(true);
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
          this.toasts.ok(`${c.name} quedó registrado con ${c.skills.length} habilidades`);
          void this.router.navigate(['/app/candidatos', c.id]);
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
        this.toasts.ok(`${c.name} quedó registrado con ${c.skills.length} habilidades`);
        void this.router.navigate(['/app/candidatos', c.id]);
      },
      error: (e) => {
        this.reading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
