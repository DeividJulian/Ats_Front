import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ArrowLeft, CircleAlert, MailCheck } from 'lucide-angular';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { errorMessage } from '../../core/utils/http-error';
import { Icon } from '../../shared/icon';

/** Same wait the backend asks between two codes. */
export const RESEND_SECONDS = 30;

/** Keeps only the digits of what was typed or pasted ("123 456" → "123456"). */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

/** Second step of the login and the sign-up: type the six-digit code that arrived by email. */
@Component({
  selector: 'app-code-step',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <form class="stack" (submit)="verify($event)" novalidate>
      <div class="alert alert--info">
        <app-icon [icon]="i.MailCheck" [size]="20" />
        <div class="alert__body">
          <div class="alert__title">Revisa tu correo</div>
          Enviamos un código de 6 dígitos a <span class="t-strong">{{ email() }}</span>. Vence en 10 minutos; si no lo ves, busca en spam.
        </div>
      </div>

      <div class="field">
        <label class="field__label" for="code">Código de verificación</label>
        <input class="input code-input" id="code" [formControl]="code" inputmode="numeric" autocomplete="one-time-code"
               maxlength="7" placeholder="000000" (input)="normalize()" [class.is-invalid]="code.touched && code.invalid" />
        @if (code.touched && code.invalid) {
          <span class="field__error"><app-icon [icon]="i.CircleAlert" [size]="15" />Escribe los 6 números del código</span>
        }
      </div>

      <button type="submit" class="btn btn--primary btn--lg btn--block" [class.is-loading]="verifying()" [disabled]="verifying()">
        @if (verifying()) { <span class="spinner"></span>Verificando… } @else { {{ submitLabel() }} }
      </button>

      <div class="row row--between">
        <button type="button" class="btn btn--ghost btn--sm" (click)="back.emit()"><app-icon [icon]="i.ArrowLeft" [size]="16" />Cambiar correo</button>
        @if (cooldown() > 0) {
          <span class="t-small t-muted" aria-live="polite">Reenviar en {{ cooldown() }} s</span>
        } @else {
          <button type="button" class="btn btn--ghost btn--sm" [class.is-loading]="resending()" [disabled]="resending()" (click)="resend()">
            @if (resending()) { <span class="spinner"></span> }Reenviar código
          </button>
        }
      </div>
    </form>
  `,
  styles: `.code-input { font-size: 26px; font-weight: 800; letter-spacing: .5em; text-align: center; font-variant-numeric: tabular-nums; }`,
})
export class CodeStep implements OnInit {
  readonly email = input.required<string>();
  readonly submitLabel = input('Entrar');
  readonly verified = output<User>();
  readonly back = output<void>();

  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly i = { ArrowLeft, CircleAlert, MailCheck };
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });
  protected readonly verifying = signal(false);
  protected readonly resending = signal(false);
  protected readonly cooldown = signal(RESEND_SECONDS);

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startCooldown();
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  protected normalize(): void {
    const clean = cleanCode(this.code.value);
    if (clean !== this.code.value) this.code.setValue(clean);
  }

  protected verify(event: Event): void {
    event.preventDefault();
    this.normalize();
    if (this.code.invalid) {
      this.code.markAsTouched();
      return;
    }
    this.verifying.set(true);
    this.auth.verify(this.email(), this.code.value).subscribe({
      next: (user) => {
        this.verifying.set(false);
        this.toasts.ok(`¡Hola, ${user.name.split(' ')[0]}!`);
        this.verified.emit(user);
      },
      error: (e) => {
        this.verifying.set(false);
        this.code.reset();
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected resend(): void {
    this.resending.set(true);
    this.auth.requestCode(this.email()).subscribe({
      next: () => {
        this.resending.set(false);
        this.code.reset();
        this.toasts.info('Te enviamos un código nuevo');
        this.startCooldown();
      },
      error: (e) => {
        this.resending.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => Math.max(0, s - 1));
      if (this.cooldown() === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
