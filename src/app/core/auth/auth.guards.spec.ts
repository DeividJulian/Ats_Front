import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { Role } from '../models';
import { authGuard, guestGuard, roleGuard } from './auth.guards';
import { TOKEN_KEY, USER_KEY } from './auth.service';
import { USER, fakeToken } from '../../../testing/fixtures';

function loginAs(role: Role | null): void {
  localStorage.clear();
  if (role) {
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) + 3600));
    localStorage.setItem(USER_KEY, JSON.stringify({ ...USER, role }));
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
}

function run(guard: typeof authGuard, url = '/app/vacantes'): boolean | string {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
}

describe('route guards', () => {
  it('authGuard sends visitors to the login and remembers the page', () => {
    loginAs(null);
    expect(run(authGuard)).toBe('/login?redirect=%2Fapp%2Fvacantes');
    loginAs('recruiter');
    expect(run(authGuard)).toBe(true);
  });

  it('roleGuard lets in only the given roles', () => {
    loginAs('recruiter');
    expect(run(roleGuard('admin', 'recruiter'))).toBe(true);
    expect(run(roleGuard('admin'))).toBe('/app');
    loginAs('candidate');
    expect(run(roleGuard('admin', 'recruiter'))).toBe('/portal');
    loginAs(null);
    expect(run(roleGuard('candidate'))).toBe('/login');
  });

  it('guestGuard sends logged-in users to their home', () => {
    loginAs(null);
    expect(run(guestGuard)).toBe(true);
    loginAs('candidate');
    expect(run(guestGuard)).toBe('/portal');
    loginAs('admin');
    expect(run(guestGuard)).toBe('/app');
  });

  it('an expired token counts as having no session', () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) - 60));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    expect(run(authGuard)).toBe('/login?redirect=%2Fapp%2Fvacantes');
    expect(run(guestGuard)).toBe(true);
  });
});
