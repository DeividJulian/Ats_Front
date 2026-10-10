import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService, homeFor } from '../core/auth/auth.service';

/** Top bar of the public pages (home, job detail, login, sign-up). */
@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  template: `
    <header class="public-header">
      <a class="brand" routerLink="/">
        <span class="logo">T</span>
        <span>Talento<span class="dot">.</span></span>
      </a>
      <nav>
        <a routerLink="/" fragment="vacantes">Vacantes</a>
        <a routerLink="/" fragment="como-funciona" class="hide-mobile">Cómo funciona</a>
        @if (auth.isLoggedIn()) {
          <a class="btn primary small" [routerLink]="home()">Ir a mi panel</a>
        } @else {
          <a class="btn small ghost" routerLink="/login">Iniciar sesión</a>
          <a class="btn primary small" routerLink="/registro">Crear cuenta</a>
        }
      </nav>
    </header>
  `,
  styles: `
    .public-header { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px clamp(16px, 4vw, 48px); background: rgba(11, 18, 32, 0.82); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(36, 50, 80, 0.6); }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; color: var(--text); }
    .brand:hover { text-decoration: none; }
    .logo { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--accent), #ff7a45); color: var(--accent-ink); font-weight: 800; }
    .dot { color: var(--accent); }
    nav { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; justify-content: flex-end; }
    nav > a:not(.btn) { color: var(--muted); font-weight: 600; font-size: 14px; }
    nav > a:not(.btn):hover { color: var(--text); text-decoration: none; }
    @media (max-width: 560px) { .hide-mobile { display: none; } }
  `,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
  protected readonly home = () => homeFor(this.auth.role());
}
