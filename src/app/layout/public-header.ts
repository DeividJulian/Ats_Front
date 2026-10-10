import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService, homeFor } from '../core/auth/auth.service';

/** Top bar of the public pages (home, job detail). */
@Component({
  selector: 'app-public-header',
  imports: [RouterLink],
  template: `
    <header class="public-header">
      <a class="brand" routerLink="/">
        <span class="logo">A<i></i></span>
        <span class="brand-text"><strong>Portal ATS</strong><span class="pill">PYME Colombia</span></span>
      </a>
      <nav>
        <a routerLink="/" fragment="vacantes" class="hide-mobile">Vacantes</a>
        <a routerLink="/" fragment="como-funciona" class="hide-mobile">Cómo funciona</a>
        @if (auth.isLoggedIn()) {
          <a class="btn primary small" [routerLink]="home()">Ir a mi panel</a>
        } @else {
          <a class="btn small outline" routerLink="/login">Iniciar sesión</a>
          <a class="btn primary small" routerLink="/registro">Crear cuenta</a>
        }
      </nav>
    </header>
  `,
  styles: `
    .public-header { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px clamp(16px, 4vw, 48px); background: rgba(255, 255, 255, 0.86); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
    .brand { display: flex; align-items: center; gap: 11px; color: var(--text); }
    .brand:hover { text-decoration: none; }
    .logo { position: relative; width: 38px; height: 38px; flex: none; border-radius: 12px; display: grid; place-items: center; font-weight: 800; font-size: 19px; color: #fff; background: linear-gradient(140deg, var(--accent), var(--accent-2)); box-shadow: 0 8px 18px -10px rgba(234, 88, 12, 0.9); }
    .logo i { position: absolute; top: 7px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: #fff; }
    .brand-text { display: grid; gap: 1px; }
    .brand-text strong { font-size: 17px; letter-spacing: -0.02em; }
    .pill { justify-self: start; padding: 1px 8px; border-radius: 999px; background: var(--peach); color: var(--peach-ink); font-size: 10.5px; font-weight: 700; }
    nav { display: flex; align-items: center; gap: 8px 16px; flex-wrap: wrap; justify-content: flex-end; }
    nav > a:not(.btn) { color: var(--muted); font-weight: 600; font-size: 14px; }
    nav > a:not(.btn):hover { color: var(--text); text-decoration: none; }
    @media (max-width: 640px) { .hide-mobile { display: none; } nav { gap: 6px; } }
  `,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
  protected readonly home = () => homeFor(this.auth.role());
}
