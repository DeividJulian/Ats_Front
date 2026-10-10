import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EducationLevel, JobInput } from '../../../core/models';
import { AiService, JobService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, splitList } from '../../../core/utils/http-error';
import { EDUCATION_LEVELS } from '../../../core/utils/labels';
import { canonicalizeSkills, extractSkills } from '../../../core/workers/cv-analysis.logic';

@Component({
  selector: 'app-job-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './job-form.html',
  styles: `
    .layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; align-items: start; }
    .side { display: grid; gap: 18px; position: sticky; top: 20px; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
  `,
})
export class JobForm implements OnInit {
  /** Route parameter: present when editing (/app/vacantes/:id/editar) */
  readonly id = input<string>();

  private readonly api = inject(JobService);
  private readonly ai = inject(AiService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly levels = EDUCATION_LEVELS;
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly aiConfigured = signal(false);
  protected readonly drafting = signal(false);
  protected readonly aiNotes = signal('');

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10000)]],
    requirements: ['', Validators.maxLength(10000)],
    skills: [''],
    min_experience_years: [0, [Validators.min(0), Validators.max(40)]],
    min_education_level: ['' as EducationLevel | ''],
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly isEdit = computed(() => !!this.id());

  /** Skills the system will use: the ones typed by hand or, if empty, the ones detected in the text. */
  protected readonly handSkills = computed(() => canonicalizeSkills(splitList(this.values().skills ?? '')));
  protected readonly detectedSkills = computed(() => {
    const v = this.values();
    return extractSkills(`${v.title ?? ''}\n${v.description ?? ''}\n${v.requirements ?? ''}`);
  });

  ngOnInit(): void {
    this.ai.status().subscribe({ next: (s) => this.aiConfigured.set(s.configured), error: () => this.aiConfigured.set(false) });
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.api.get(Number(id)).subscribe({
      next: (job) => {
        this.form.setValue({
          title: job.title,
          description: job.description,
          requirements: job.requirements,
          skills: job.required_skills.join(', '),
          min_experience_years: job.min_experience_years,
          min_education_level: job.min_education_level ?? '',
        });
        this.loading.set(false);
      },
      error: (e) => {
        this.toasts.error(errorMessage(e));
        void this.router.navigateByUrl('/app/vacantes');
      },
    });
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected useDetected(): void {
    this.form.controls.skills.setValue(this.detectedSkills().join(', '));
  }

  protected draftWithAi(): void {
    const title = this.form.controls.title.value.trim();
    if (title.length < 3) {
      this.form.controls.title.markAsTouched();
      this.toasts.info('Escribe primero el nombre del cargo');
      return;
    }
    this.drafting.set(true);
    this.ai.draftJob(title, this.aiNotes()).subscribe({
      next: (draft) => {
        this.form.patchValue({
          description: draft.description,
          requirements: draft.requirements,
          skills: draft.required_skills.join(', '),
          min_experience_years: draft.min_experience_years,
          min_education_level: draft.min_education_level ?? '',
        });
        this.drafting.set(false);
        this.toasts.ok('Borrador listo: revísalo y ajústalo antes de guardar');
      },
      error: (e) => {
        this.drafting.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: JobInput = {
      title: v.title.trim(),
      description: v.description.trim(),
      requirements: v.requirements.trim(),
      required_skills: splitList(v.skills),
      min_experience_years: Number(v.min_experience_years) || 0,
      min_education_level: v.min_education_level || null,
    };
    const id = this.id();
    this.saving.set(true);
    (id ? this.api.update(Number(id), input) : this.api.create(input)).subscribe({
      next: (job) => {
        this.toasts.ok(id ? 'Vacante actualizada' : 'Vacante publicada');
        void this.router.navigate(['/app/vacantes', job.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
