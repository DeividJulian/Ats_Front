import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { Candidate, CandidateInsights, EducationLevel, ProfileInput } from '../../../core/models';
import { PortalService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, splitList } from '../../../core/utils/http-error';
import { EDUCATION_LEVELS } from '../../../core/utils/labels';
import { InsightsCard } from '../../../shared/insights-card';
import { PdfDrop } from '../../../shared/pdf-drop';
import { profileCompleteness } from '../profile-completeness';

@Component({
  selector: 'app-portal-profile',
  imports: [ReactiveFormsModule, PdfDrop, InsightsCard],
  templateUrl: './profile.html',
  styles: `
    .layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; align-items: start; }
    .col { display: grid; gap: 18px; }
    .meter { height: 10px; border-radius: 99px; background: var(--surface-2); overflow: hidden; }
    .meter span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), #ff7a45); transition: width 0.4s ease; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class PortalProfile {
  private readonly portal = inject(PortalService);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly levels = EDUCATION_LEVELS;
  protected readonly profile = signal<Candidate | null>(null);
  protected readonly insights = signal<CandidateInsights | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);

  protected readonly completeness = computed(() => {
    const p = this.profile();
    return p ? profileCompleteness(p) : null;
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    experience_years: ['' as number | ''],
    education_level: ['' as EducationLevel | ''],
    skills: [''],
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
    this.form.setValue({
      name: profile.name,
      phone: profile.phone ?? '',
      experience_years: profile.experience_years || '',
      education_level: profile.education_level ?? '',
      skills: profile.skills.join(', '),
      resume_text: profile.resume_text,
    });
  }

  private refreshInsights(): void {
    this.portal.insights().subscribe((i) => this.insights.set(i));
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
      skills: splitList(v.skills),
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
