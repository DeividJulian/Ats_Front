import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  Briefcase,
  ChevronDown,
  ClipboardList,
  House,
  LayoutGrid,
  LogOut,
  ShieldCheck,
  Trophy,
  User,
  UserSearch,
  Zap,
} from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';
import { filter, map } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { Role } from '../core/models';
import { initials } from '../core/utils/http-error';
import { Icon } from '../shared/icon';
import { LabelPipe } from '../shared/label.pipe';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIconData;
  exact?: boolean;
  /** Small tag over the icon in the bottom bar, as "Worker" */
  tag?: string;
}

/** Menu of each role. */
export function navFor(role: Role | null): NavItem[] {
  if (role === 'candidate') {
    return [
      { path: '/portal', label: 'Inicio', icon: House, exact: true },
      { path: '/portal/vacantes', label: 'Vacantes', icon: Briefcase },
      { path: '/portal/postulaciones', label: 'Postulaciones', icon: ClipboardList },
      { path: '/portal/perfil', label: 'Mi perfil', icon: User },
    ];
  }
  const staff: NavItem[] = [
    { path: '/app', label: 'Panel', icon: LayoutGrid, exact: true },
    { path: '/app/vacantes', label: 'Vacantes', icon: Briefcase },
    { path: '/app/ranking', label: 'Ranking', icon: Trophy },
    { path: '/app/candidatos', label: 'Candidatos', icon: UserSearch },
    { path: '/app/analisis', label: 'Análisis', icon: Zap, tag: 'Worker' },
  ];
  if (role === 'admin') staff.push({ path: '/app/usuarios', label: 'Usuarios', icon: ShieldCheck });
  return staff;
}

/** Name of the section for the top bar: the most specific menu entry that matches the URL. */
export function sectionFor(url: string, items: NavItem[]): string {
  const path = url.split(/[?#]/)[0];
  const match = items
    .filter((i) => (i.exact ? path === i.path : path === i.path || path.startsWith(i.path + '/')))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.label ?? '';
}

/** Frame of the private area: side menu on desktop, bottom bar on phones, user menu. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LabelPipe, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly icons = { LogOut, ChevronDown, ShieldCheck };
  protected readonly nav = computed(() => navFor(this.auth.role()));
  /** On phones the bottom bar has room for five entries; the rest live in the user menu. */
  protected readonly bottomNav = computed(() => this.nav().slice(0, 5));
  protected readonly initials = computed(() => initials(this.auth.user()?.name));
  protected readonly menuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly section = computed(() => sectionFor(this.url(), this.nav()));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuOpen.set(false));
  }

  protected logout(): void {
    this.auth.logout('/');
  }
}
