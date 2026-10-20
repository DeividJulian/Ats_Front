import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SearchX } from 'lucide-angular';

import { AuthService, homeFor } from '../../core/auth/auth.service';
import { PublicHeader } from '../../layout/public-header';
import { Icon } from '../../shared/icon';

/** Wrong or old link: says so and offers a way back, instead of silently going to the home page. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, PublicHeader, Icon],
  template: `
    <app-public-header />
    <main class="container page-body">
      <div class="card empty">
        <span class="empty__icon"><app-icon [icon]="icon" [size]="32" /></span>
        <p class="t-label">Error 404</p>
        <h1 class="empty__title">No encontramos esta página</h1>
        <p class="empty__text">La dirección <code>{{ path() }}</code> no existe o cambió. Revisa el enlace o vuelve a un lugar conocido.</p>
        <div class="row" style="justify-content: center">
          <a class="btn btn--primary" [routerLink]="home()">{{ auth.isLoggedIn() ? 'Ir a mi panel' : 'Ir al inicio' }}</a>
          <a class="btn btn--secondary" routerLink="/" fragment="vacantes">Ver vacantes</a>
        </div>
      </div>
    </main>
  `,
  styles: `.page-body { padding-top: 48px; padding-bottom: 72px; }`,
})
export class NotFound {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly icon = SearchX;
  protected readonly home = computed(() => (this.auth.isLoggedIn() ? homeFor(this.auth.role()) : '/'));
  protected readonly path = () => this.router.url;
}
