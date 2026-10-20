import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChartColumn, CircleAlert, Clock, FileText, ListOrdered, Mail, ShieldCheck } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/models';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { afterLoginUrl } from './auth-redirect';
import { CodeStep } from './code-step';

/** Passwordless login: email first, then the six-digit code that arrives there. */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon, CodeStep],
  templateUrl: './login.html',
  styleUrl: './auth.css',
})
export class Login {
  /** Query parameters: page to return to, and whether the previous session expired */
  readonly redirect = input<string>();
  readonly expired = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly i = { ChartColumn, CircleAlert, Clock, FileText, ListOrdered, Mail, ShieldCheck };
  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly email = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected bad(): boolean {
    const control = this.form.controls.email;
    return control.touched && control.invalid;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.email.value.trim().toLowerCase();
    this.sending.set(true);
    this.error.set(null);
    this.auth.requestCode(email).subscribe({
      next: () => {
        this.sending.set(false);
        this.email.set(email);
        this.step.set('code');
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  protected enter(user: User): void {
    void this.router.navigateByUrl(afterLoginUrl(this.redirect(), user.role));
  }
}
