import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Search, Sparkles, Trash2, UserPlus } from 'lucide-angular';

import { AuthService } from '../../../core/auth/auth.service';
import { AiStatus, Role, User, UserUpdate } from '../../../core/models';
import { AiService, StatsService, UserService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage, initials } from '../../../core/utils/http-error';
import { normalize } from '../../../core/workers/cv-analysis.logic';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { Icon } from '../../../shared/icon';
import { Modal } from '../../../shared/modal';

export type AccountState = 'all' | 'active' | 'unverified' | 'inactive';

/** Where an account stands: deactivated, waiting for its first code, or in use. */
export function accountState(user: User): Exclude<AccountState, 'all'> {
  if (!user.is_active) return 'inactive';
  return user.verified ? 'active' : 'unverified';
}

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, DatePipe, LabelPipe, Icon, Modal],
  templateUrl: './users.html',
  styles: `
    .toolbar .control:first-child { max-width: 460px; }
    .role-filter { flex: 0 1 220px; }
    .select--sm { width: auto; min-height: 36px; padding: 6px 38px 6px 12px; font-size: 13.5px; }
    .inactive td { opacity: .6; }
  `,
})
export class Users {
  private readonly api = inject(UserService);
  private readonly statsApi = inject(StatsService);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  private readonly ai = inject(AiService);

  protected readonly i = { Search, Sparkles, Trash2, UserPlus };
  protected readonly tones = ['avatar', 'avatar avatar--b', 'avatar avatar--g', 'avatar avatar--a'];
  protected readonly initials = initials;
  protected readonly roleBadge: Record<Role, string> = { admin: 'badge--admin', recruiter: 'badge--reclutador', candidate: 'badge--candidato' };
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly search = signal('');
  protected readonly roleFilter = signal<'all' | Role>('all');
  protected readonly stateFilter = signal<AccountState>('all');
  protected readonly users = signal<User[]>([]);
  /** Account whose access code is being sent. */
  protected readonly sendingTo = signal<number | null>(null);
  protected readonly visible = computed(() => {
    const term = normalize(this.search().trim());
    return this.users().filter(
      (u) =>
        (this.roleFilter() === 'all' || u.role === this.roleFilter()) &&
        (this.stateFilter() === 'all' || accountState(u) === this.stateFilter()) &&
        (!term || normalize(`${u.name} ${u.email}`).includes(term)),
    );
  });
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly seeding = signal(false);

  protected readonly counts = computed(() => {
    const list = this.users();
    return {
      admin: list.filter((u) => u.role === 'admin').length,
      recruiter: list.filter((u) => u.role === 'recruiter').length,
      candidate: list.filter((u) => u.role === 'candidate').length,
    };
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['recruiter' as 'admin' | 'recruiter'],
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
    this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
  }

  protected load(): void {
    this.api.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected isMe(user: User): boolean {
    return user.id === this.auth.user()?.id;
  }

  protected create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.create(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.creating.set(false);
        this.form.reset({ name: '', email: '', role: 'recruiter' });
        this.toasts.ok(`Cuenta creada: ${user.name} entra con el código que le llegará a ${user.email}`);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected update(user: User, changes: UserUpdate, message: string): void {
    this.api.update(user.id, changes).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.toasts.ok(message);
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected changeRole(user: User, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as 'admin' | 'recruiter';
    this.update(user, { role }, `${user.name} ahora es ${role === 'admin' ? 'administrador' : 'reclutador'}`);
  }

  protected toggleActive(user: User): void {
    this.update(user, { is_active: !user.is_active }, user.is_active ? `${user.name} quedó desactivado` : `${user.name} quedó activo`);
  }

  /** Emails the access code, the same one the person would get from the login page. */
  protected sendCode(user: User): void {
    this.sendingTo.set(user.id);
    this.auth.requestCode(user.email).subscribe({
      next: () => {
        this.sendingTo.set(null);
        this.toasts.ok(`Le enviamos a ${user.name} un código para entrar (${user.email})`);
      },
      error: (e) => {
        this.sendingTo.set(null);
        this.toasts.error(errorMessage(e));
      },
    });
  }

  protected remove(user: User): void {
    const extra = user.role === 'candidate' ? ' Su perfil y sus postulaciones se conservan.' : '';
    if (!confirm(`¿Eliminar la cuenta de ${user.name}?${extra}`)) return;
    this.api.remove(user.id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.toasts.ok('Cuenta eliminada');
      },
      error: (e) => this.toasts.error(errorMessage(e)),
    });
  }

  protected loadDemo(reset: boolean): void {
    if (reset && !confirm('Esto BORRA todas las vacantes, candidatos, postulaciones y cuentas que no sean de administrador. ¿Continuar?')) return;
    this.seeding.set(true);
    this.statsApi.loadDemo(reset).subscribe({
      next: () => {
        this.seeding.set(false);
        this.toasts.ok('Datos de demostración cargados');
        this.load();
      },
      error: (e) => {
        this.seeding.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
