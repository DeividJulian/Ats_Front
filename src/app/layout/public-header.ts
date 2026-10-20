import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChartColumn, LogOut, Moon, Sun } from 'lucide-angular';

import { AuthService, homeFor } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { Icon } from '../shared/icon';

/** Top bar of the public pages (home, job detail). */
@Component({
  selector: 'app-public-header',
  imports: [RouterLink, Icon],
  template: `
    <header class="site-header">
      <div class="container site-header__in">
        <a class="brand" routerLink="/"><span class="brand__mark"><app-icon [icon]="icons.ChartColumn" [size]="20" [stroke]="2.25" /></span>Portal ATS</a>
        <nav class="site-nav" aria-label="Principal">
          <a routerLink="/" fragment="vacantes">Vacantes</a>
          <a routerLink="/" fragment="como-funciona">Cómo funciona</a>
          <a routerLink="/" fragment="ia">IA asesora</a>
        </nav>
        <span class="spacer"></span>
        <button type="button" class="btn btn--ghost btn--icon" (click)="theme.toggle()"
                [attr.aria-label]="theme.theme() === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
          <app-icon [icon]="theme.theme() === 'dark' ? icons.Sun : icons.Moon" [size]="20" />
        </button>
        @if (auth.isLoggedIn()) {
          <span class="t-small t-strong hide-m">{{ auth.user()?.name }}</span>
          <a class="btn btn--primary" [routerLink]="home()">Ir a mi panel</a>
          <button type="button" class="btn btn--ghost btn--icon" aria-label="Cerrar sesión" title="Cerrar sesión" (click)="auth.logout('/')">
            <app-icon [icon]="icons.LogOut" [size]="20" />
          </button>
        } @else {
          <a class="btn btn--ghost hide-m" routerLink="/login">Iniciar sesión</a>
          <a class="btn btn--primary hide-m" routerLink="/registro">Crear cuenta</a>
          <a class="btn btn--primary btn--sm show-m" routerLink="/login">Ingresar</a>
        }
      </div>
    </header>
  `,
  styles: `.site-header { position: sticky; top: 0; z-index: 40; }`,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly icons = { ChartColumn, LogOut, Moon, Sun };
  protected readonly home = () => homeFor(this.auth.role());
}
