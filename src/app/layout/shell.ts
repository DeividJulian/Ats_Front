import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { Role } from '../core/models';
import { initials } from '../core/utils/http-error';
import { LabelPipe } from '../shared/label.pipe';

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}

/** Menu of each role. */
export function navFor(role: Role | null): NavItem[] {
  if (role === 'candidate') {
    return [
      { path: '/portal', label: 'Inicio', icon: '🏠', exact: true },
      { path: '/portal/vacantes', label: 'Vacantes', icon: '💼' },
      { path: '/portal/postulaciones', label: 'Mis postulaciones', icon: '📋' },
      { path: '/portal/perfil', label: 'Mi perfil', icon: '👤' },
    ];
  }
  const staff: NavItem[] = [
    { path: '/app', label: 'Panel', icon: '📊', exact: true },
    { path: '/app/vacantes', label: 'Vacantes', icon: '💼' },
    { path: '/app/candidatos', label: 'Candidatos', icon: '👥' },
    { path: '/app/analisis', label: 'Análisis masivo', icon: '⚡' },
  ];
  if (role === 'admin') staff.push({ path: '/app/usuarios', label: 'Usuarios', icon: '🔐' });
  return staff;
}

/** Frame of the private area: side menu (by role), user and logout. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LabelPipe],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly nav = computed(() => navFor(this.auth.role()));
  protected readonly initials = computed(() => initials(this.auth.user()?.name));
  protected readonly menuOpen = signal(false);

  constructor() {
    // On phones the menu closes after choosing a page
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuOpen.set(false));
  }

  protected logout(): void {
    this.auth.logout('/');
  }
}
