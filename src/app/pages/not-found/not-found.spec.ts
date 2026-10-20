import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from '../../app.routes';
import { TOKEN_KEY, USER_KEY } from '../../core/auth/auth.service';
import { USER, fakeToken } from '../../../testing/fixtures';
import { NotFound } from './not-found';

describe('NotFound page', () => {
  beforeEach(() => localStorage.clear());

  it('is what unknown addresses show', () => {
    const wildcard = routes.at(-1)!;
    expect(wildcard.path).toBe('**');
    expect(wildcard.redirectTo).toBeUndefined();
  });

  it('shows the address and a way back home for visitors', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/vacantes-viejas');
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('No encontramos esta página');
    expect(page.textContent).toContain('/vacantes-viejas');
    expect(page.querySelector('main a.btn--primary')?.textContent).toContain('Ir al inicio');
  });

  it('sends a logged-in user to their panel', async () => {
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) + 3600));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('main a.btn--primary')!;
    expect(link.textContent).toContain('Ir a mi panel');
    expect(link.getAttribute('href')).toBe('/app');
  });
});
