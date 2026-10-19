import { Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Building2, ChartColumn, CircleAlert, Clock, Eye, EyeOff, FileText, ListOrdered, Lock, Mail, ShieldCheck, User } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';
import { afterLoginUrl } from './auth-redirect';

/** Demo accounts created by POST /seed on the backend. */
export const DEMO_ACCOUNTS = [
  { label: 'empresa', role: 'recruiter', email: 'reclutador@demo.com', password: 'Demo1234' },
  { label: 'candidata', role: 'candidate', email: 'camila.ortega@example.com', password: 'Demo1234' },
];

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Icon],
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

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly i = { Building2, ChartColumn, CircleAlert, Clock, Eye, EyeOff, FileText, ListOrdered, Lock, Mail, ShieldCheck, User };
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected bad(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.signIn(email, password);
  }

  protected useDemo(account: (typeof DEMO_ACCOUNTS)[number]): void {
    this.form.setValue({ email: account.email, password: account.password });
    this.signIn(account.email, account.password);
  }

  private signIn(email: string, password: string): void {
    this.sending.set(true);
    this.error.set(null);
    this.auth.login(email.trim(), password).subscribe({
      next: (user) => {
        this.toasts.ok(`¡Hola, ${user.name.split(' ')[0]}!`);
        void this.router.navigateByUrl(afterLoginUrl(this.redirect(), user.role));
      },
      error: (e) => {
        this.sending.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
