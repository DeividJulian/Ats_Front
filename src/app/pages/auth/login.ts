import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Building2, ChartColumn, CircleAlert, Clock, FileText, ListOrdered, Mail, ShieldCheck, User as UserIcon } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { DemoAccount, User } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { afterLoginUrl } from './auth-redirect';
import { CodeStep } from './code-step';

/** Demo accounts created by POST /seed. Their emails are fake, so they enter without a code when the server allows it. */
export const DEMO_ACCOUNTS: { label: string; account: DemoAccount }[] = [
  { label: 'empresa', account: 'recruiter' },
  { label: 'candidata', account: 'candidate' },
];

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
  private readonly toasts = inject(ToastService);

  protected readonly i = { Building2, ChartColumn, CircleAlert, Clock, FileText, ListOrdered, Mail, ShieldCheck, UserIcon };
  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly step = signal<'email' | 'code'>('email');
  protected readonly email = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly demoEnabled = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.auth.options().subscribe({ next: (o) => this.demoEnabled.set(o.demo_login), error: () => this.demoEnabled.set(false) });
  }

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

  protected useDemo(account: DemoAccount): void {
    this.sending.set(true);
    this.error.set(null);
    this.auth.demo(account).subscribe({
      next: (user) => {
        this.toasts.ok(`¡Hola, ${user.name.split(' ')[0]}!`);
        this.enter(user);
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
