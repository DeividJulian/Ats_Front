import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Building2, ChartColumn, CircleAlert } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { afterLoginUrl } from './auth-redirect';
import { CodeStep } from './code-step';

/** Candidate sign-up without a password: name and email, then the code that activates the account. */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, Icon, CodeStep],
  templateUrl: './register.html',
  styleUrl: './auth.css',
})
export class Register {
  /** Query parameter: page to return to (for example, the job the user wanted to apply to) */
  readonly redirect = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly i = { Building2, ChartColumn, CircleAlert };
  protected readonly step = signal<'form' | 'code'>('form');
  protected readonly email = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
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
    const { name, email, phone } = this.form.getRawValue();
    this.sending.set(true);
    this.error.set(null);
    this.auth.register({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null }).subscribe({
      next: (sent) => {
        this.sending.set(false);
        this.email.set(sent.email);
        this.step.set('code');
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  protected activated(user: User): void {
    this.toasts.info('Completa tu perfil para recibir recomendaciones');
    const target = this.redirect() ? afterLoginUrl(this.redirect(), user.role) : '/portal/perfil';
    void this.router.navigateByUrl(target);
  }
}
