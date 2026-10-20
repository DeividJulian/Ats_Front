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
    <form class="stack" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <div class="form-grid">
        <div class="field">
          <label class="field__label" for="cf-name">Nombre <span class="req">*</span></label>
          <input class="input" id="cf-name" formControlName="name" [class.is-invalid]="invalid('name')" />
          @if (invalid('name')) { <span class="field__error">Mínimo 2 caracteres</span> }
        </div>
        <div class="field">
          <label class="field__label" for="cf-mail">Correo <span class="req">*</span></label>
          <input class="input" id="cf-mail" type="email" formControlName="email" [class.is-invalid]="invalid('email')" />
          @if (invalid('email')) { <span class="field__error">Correo no válido</span> }
        </div>
        <div class="field">
          <label class="field__label" for="cf-phone">Teléfono</label>
          <input class="input" id="cf-phone" formControlName="phone" />
        </div>
        <div class="field">
          <label class="field__label" for="cf-exp">Años de experiencia</label>
          <input class="input" id="cf-exp" type="number" min="0" max="45" formControlName="experience_years" placeholder="Vacío: se detecta" />
        </div>
        <div class="field">
          <label class="field__label" for="cf-edu">Nivel educativo</label>
          <select class="select" id="cf-edu" formControlName="education_level">
            <option value="">Detectar de la hoja de vida</option>
            @for (l of levels; track l.value) { <option [value]="l.value">{{ l.label }}</option> }
          </select>
        </div>
        <div class="field">
          <label class="field__label" for="cf-skills">Habilidades</label>
          <input class="input" id="cf-skills" formControlName="skills" />
          <span class="field__hint">Separadas por comas.</span>
        </div>
        <div class="field full">
          <label class="field__label" for="cf-cv">Texto de la hoja de vida</label>
          <textarea class="textarea" id="cf-cv" formControlName="resume_text" placeholder="Pega aquí la hoja de vida: el sistema detecta habilidades, experiencia y educación."></textarea>
        </div>
      </div>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="btn btn--ghost" (click)="cancelled.emit()">Cancelar</button>
        <button type="submit" class="btn btn--primary" [class.is-loading]="saving()" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span>Guardando… } @else { {{ candidate() ? 'Guardar cambios' : 'Crear candidato' }} }
        </button>
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
