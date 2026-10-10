import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../../core/auth/auth.service';
import { User, UserUpdate } from '../../../core/models';
import { StatsService, UserService } from '../../../core/services/api.services';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../core/utils/http-error';
import { reloadOnRemoteChanges } from '../../../core/workers/tab-sync.service';
import { LabelPipe } from '../../../shared/label.pipe';
import { Modal } from '../../../shared/modal';

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, DatePipe, LabelPipe, Modal],
  templateUrl: './users.html',
  styles: `
    .role-select { width: auto; padding: 6px 10px; font-size: 13px; }
    .inactive td { opacity: 0.55; }
    .danger-zone { border-color: rgba(248, 113, 113, 0.4); }
  `,
})
export class Users {
  private readonly api = inject(UserService);
  private readonly statsApi = inject(StatsService);
  private readonly toasts = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly users = signal<User[]>([]);
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
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['recruiter' as 'admin' | 'recruiter'],
  });

  constructor() {
    reloadOnRemoteChanges(() => this.load());
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
        this.form.reset({ name: '', email: '', password: '', role: 'recruiter' });
        this.toasts.ok(`Cuenta creada para ${user.name}`);
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

  protected resetPassword(user: User): void {
    const password = prompt(`Nueva contraseña para ${user.name} (mínimo 8 caracteres):`);
    if (!password) return;
    if (password.length < 8) {
      this.toasts.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.update(user, { password }, 'Contraseña actualizada');
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
        this.toasts.ok('Datos de demostración cargados. Cuentas: reclutador@demo.com y camila.ortega@example.com (clave Demo1234)');
        this.load();
      },
      error: (e) => {
        this.seeding.set(false);
        this.toasts.error(errorMessage(e));
      },
    });
  }
}
