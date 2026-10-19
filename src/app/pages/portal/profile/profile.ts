import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Circle, CircleAlert, CircleCheck, Plus, Save, X } from 'lucide-angular';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Candidate, CandidateInsights, EducationLevel, ProfileInput } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { EDUCATION_LEVELS } from '../../../core/utils/labels';
import { canonicalizeSkills } from '../../../core/workers/cv-analysis.logic';
import { Icon } from '../../../shared/icon';
import { InsightsCard } from '../../../shared/insights-card';
import { PdfDrop } from '../../../shared/pdf-drop';
import { profileChecklist, profileCompleteness } from '../profile-completeness';

@Component({
  selector: 'app-portal-profile',
  imports: [ReactiveFormsModule, PdfDrop, InsightsCard, Icon],
  templateUrl: './profile.html',
  styles: `
    .ok { color: var(--c-success); }
  `,
})
export class PortalProfile {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly i = { Circle, CircleAlert, CircleCheck, Plus, Save, X };
  protected readonly levels = EDUCATION_LEVELS;
  protected readonly profile = signal<Candidate | null>(null);
  protected readonly insights = signal<CandidateInsights | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly skills = signal<string[]>([]);
  protected readonly newSkill = signal('');

  protected readonly completeness = computed(() => {
    const p = this.profile();
    return p ? profileCompleteness(p) : null;
  });
  protected readonly checklist = computed(() => {
    const p = this.profile();
    return p ? profileChecklist(p) : [];
  });
  /** The skills open jobs ask for that the profile still lacks, to add with one click. */
  protected readonly suggested = computed(() => {
    const have = new Set(this.skills());
    return (this.insights()?.skills_to_develop ?? []).map((s) => s.skill).filter((s) => !have.has(s)).slice(0, 4);
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    experience_years: ['' as number | ''],
    education_level: ['' as EducationLevel | ''],
    resume_text: [''],
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    forkJoin({ profile: this.portal.profile(), insights: this.portal.insights() }).subscribe({
      next: ({ profile, insights }) => {
        this.show(profile);
        this.insights.set(insights);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  private show(profile: Candidate): void {
    this.profile.set(profile);
    this.skills.set(profile.skills);
    this.form.setValue({
      name: profile.name,
      phone: profile.phone ?? '',
      experience_years: profile.experience_years || '',
      education_level: profile.education_level ?? '',
      resume_text: profile.resume_text,
    });
  }

  private refreshInsights(): void {
    this.portal.insights().subscribe((i) => this.insights.set(i));
  }

  protected addSkill(value = this.newSkill()): void {
    const skill = value.trim();
    if (!skill) return;
    this.skills.set(canonicalizeSkills([...this.skills(), skill]));
    this.newSkill.set('');
  }

  protected removeSkill(skill: string): void {
    this.skills.update((list) => list.filter((s) => s !== skill));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: ProfileInput = {
      name: v.name.trim(),
      phone: v.phone.trim() || null,
      resume_text: v.resume_text.trim(),
      skills: this.skills(),
      experience_years: v.experience_years === '' ? null : Number(v.experience_years),
      education_level: v.education_level || null,
    };
    this.saving.set(true);
    this.portal.updateProfile(input).subscribe({
      next: (profile) => {
        this.saving.set(false);
        this.show(profile);
        this.refreshInsights();
        this.auth.refresh().subscribe();
        this.toasts.ok('Perfil guardado');
      },
      error: (e) => {
        this.saving.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected upload(file: File): void {
    this.uploading.set(true);
    this.portal.uploadResume(file).subscribe({
      next: (profile) => {
        this.uploading.set(false);
        this.show(profile);
        this.refreshInsights();
        this.toasts.ok(`¡Listo! Detectamos ${profile.skills.length} habilidades en tu hoja de vida`);
      },
      error: (e) => {
        this.uploading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
