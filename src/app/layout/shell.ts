import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  Briefcase,
  ChartColumn,
  ClipboardList,
  Files,
  House,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  User,
  Users,
} from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';
import { filter, map } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { AiStatus, Role } from '../core/models';
import { AiService } from '../core/services/api.services';
import { ThemeService } from '../core/services/theme.service';
import { initials } from '../core/utils/http-error';
import { aiProviderLabel } from '../core/utils/labels';
import { Icon } from '../shared/icon';
import { LabelPipe } from '../shared/label.pipe';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIconData;
  exact?: boolean;
  /** Shorter name for the phone bottom bar */
  short?: string;
  /** Entries under the "Administración" heading of the side menu */
  admin?: boolean;
}

/** Menu of each role. */
export function navFor(role: Role | null): NavItem[] {
  if (role === 'candidate') {
    return [
      { path: '/portal', label: 'Inicio', icon: House, exact: true },
      { path: '/portal/vacantes', label: 'Vacantes', icon: Briefcase },
      { path: '/portal/postulaciones', label: 'Mis postulaciones', short: 'Postulaciones', icon: ClipboardList },
      { path: '/portal/perfil', label: 'Mi perfil', short: 'Perfil', icon: User },
    ];
  }
  const staff: NavItem[] = [
    { path: '/app', label: 'Panel', icon: LayoutDashboard, exact: true },
    { path: '/app/vacantes', label: 'Vacantes', icon: Briefcase },
    { path: '/app/candidatos', label: 'Candidatos', icon: Users },
    { path: '/app/ranking', label: 'Ranking', icon: ListOrdered },
    { path: '/app/analisis', label: 'Análisis masivo', short: 'Análisis', icon: Files },
  ];
  if (role === 'admin') staff.push({ path: '/app/usuarios', label: 'Usuarios', icon: ShieldCheck, admin: true });
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

/** Frame of the private area: side menu (team) or top menu (candidates), and a bottom bar on phones. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, LabelPipe, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly ai = inject(AiService);

  protected readonly icons = { LogOut, Menu, Moon, Sun, Plus, ChartColumn };
  protected readonly isCandidate = computed(() => this.auth.role() === 'candidate');
  protected readonly nav = computed(() => navFor(this.auth.role()));
  protected readonly mainNav = computed(() => this.nav().filter((i) => !i.admin));
  protected readonly adminNav = computed(() => this.nav().filter((i) => i.admin));
  /** The bottom bar fits four entries; the team gets the rest under "Más". */
  protected readonly bottomNav = computed(() => this.nav().slice(0, 4));
  protected readonly moreNav = computed(() => this.nav().slice(4));
  protected readonly initials = computed(() => initials(this.auth.user()?.name));
  protected readonly menuOpen = signal(false);
  protected readonly moreOpen = signal(false);
  protected readonly aiStatus = signal<AiStatus | null>(null);
  protected readonly aiLabel = computed(() => aiProviderLabel(this.aiStatus()?.provider));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly section = computed(() => sectionFor(this.url(), this.nav()));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      this.moreOpen.set(false);
    });
    if (!this.isCandidate()) {
      this.ai.status().subscribe({ next: (s) => this.aiStatus.set(s), error: () => this.aiStatus.set(null) });
    }
  }

  protected logout(): void {
    this.auth.logout('/');
  }
}
