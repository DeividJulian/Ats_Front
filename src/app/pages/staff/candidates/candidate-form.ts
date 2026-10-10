import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Candidate, CandidateInput, EducationLevel } from '../../../core/models';
import { CandidateService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, splitList } from '../../../core/utils/http-error';
import { EDUCATION_LEVELS } from '../../../core/utils/labels';

/** Create or edit a candidate by hand. What is left empty is detected from the resume text. */
@Component({
  selector: 'app-candidate-form',
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="two">
        <label>Nombre<input formControlName="name" [class.invalid]="invalid('name')" />
          @if (invalid('name')) { <span class="error-text">Mínimo 2 caracteres</span> }
        </label>
        <label>Correo<input type="email" formControlName="email" [class.invalid]="invalid('email')" />
          @if (invalid('email')) { <span class="error-text">Correo no válido</span> }
        </label>
        <label>Teléfono <span class="hint">(opcional)</span><input formControlName="phone" /></label>
        <label>Años de experiencia <span class="hint">(vacío: se detecta)</span><input type="number" min="0" max="45" formControlName="experience_years" /></label>
        <label>Nivel educativo
          <select formControlName="education_level">
            <option value="">Detectar de la hoja de vida</option>
            @for (l of levels; track l.value) { <option [value]="l.value">{{ l.label }}</option> }
          </select>
        </label>
        <label>Habilidades adicionales <span class="hint">(separadas por comas)</span><input formControlName="skills" /></label>
      </div>
      <label>Texto de la hoja de vida<textarea formControlName="resume_text" rows="7" placeholder="Pega aquí la hoja de vida: el sistema detecta habilidades, experiencia y educación."></textarea></label>
      <div class="row">
        <button type="submit" class="btn primary" [disabled]="saving()">{{ saving() ? 'Guardando…' : candidate() ? 'Guardar cambios' : 'Crear candidato' }}</button>
        <button type="button" class="btn ghost" (click)="cancelled.emit()">Cancelar</button>
      </div>
    </form>
  `,
})
export class CandidateForm implements OnInit {
  /** Candidate to edit; empty to create a new one */
  readonly candidate = input<Candidate | null>(null);
  readonly saved = output<Candidate>();
  readonly cancelled = output<void>();

  private readonly api = inject(CandidateService);
  private readonly toasts = inject(ToastService);

  protected readonly levels = EDUCATION_LEVELS;
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    experience_years: ['' as number | ''],
    education_level: ['' as EducationLevel | ''],
    skills: [''],
    resume_text: [''],
  });

  ngOnInit(): void {
    const c = this.candidate();
    if (c) {
      this.form.setValue({
        name: c.name,
        email: c.email,
        phone: c.phone ?? '',
        experience_years: c.experience_years,
        education_level: c.education_level ?? '',
        skills: c.skills.join(', '),
        resume_text: c.resume_text,
      });
    }
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input: CandidateInput = {
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim() || null,
      resume_text: v.resume_text.trim(),
      skills: splitList(v.skills),
      experience_years: v.experience_years === '' ? null : Number(v.experience_years),
      education_level: v.education_level || null,
    };
    const existing = this.candidate();
    this.saving.set(true);
    (existing ? this.api.update(existing.id, input) : this.api.create(input)).subscribe({
      next: (c) => {
        this.saving.set(false);
        this.toasts.ok(existing ? 'Candidato actualizado' : 'Candidato creado');
        this.saved.emit(c);
      },
      error: (e) => {
        this.saving.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
