import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Building2, ChartColumn, CircleAlert, Eye, EyeOff } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { afterLoginUrl } from './auth-redirect';

/** Both password fields must match. */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

const STRENGTH = [
  { label: 'Usa letras, números y un símbolo', color: 'var(--c-border)' },
  { label: 'Seguridad: débil', color: 'var(--c-danger)' },
  { label: 'Seguridad: aceptable', color: 'var(--c-warning)' },
  { label: 'Seguridad: buena', color: 'var(--c-success)' },
  { label: 'Seguridad: muy segura', color: 'var(--c-success)' },
];

/** 0 when empty, then 1 to 4 by length, mixed case, digits and symbols. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(score, 1);
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './register.html',
  styleUrl: './auth.css',
})
export class Register {
  /** Query parameter: page to return to (for example, the job the user wanted to apply to) */
  readonly redirect = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected readonly i = { Building2, ChartColumn, CircleAlert, Eye, EyeOff };
  private readonly password = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });
  protected readonly strength = computed(() => {
    const level = passwordStrength(this.password());
    return { pct: level * 25, ...STRENGTH[level] };
  });

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, phone, password } = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.auth.register({ name: name.trim(), email: email.trim(), phone: phone.trim() || null, password }).subscribe({
      next: (user) => {
        this.toasts.ok(`¡Bienvenido, ${user.name.split(' ')[0]}! Completa tu perfil para recibir recomendaciones.`);
        const target = this.redirect() ? afterLoginUrl(this.redirect(), user.role) : '/portal/perfil';
        void this.router.navigateByUrl(target);
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
