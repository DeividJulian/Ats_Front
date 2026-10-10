import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_URL } from '../config/api.config';
import { TokenResponse, User } from '../models';
import { USER, fakeToken } from '../../../testing/fixtures';
import { AuthService, TOKEN_KEY, USER_KEY, homeFor, isTokenExpired, tokenExpiry } from './auth.service';

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('starts without a session', () => {
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.role()).toBeNull();
  });

  it('logs in and keeps the session in localStorage', () => {
    const { auth, http } = setup();
    const token = fakeToken(inOneHour());
    let result: User | undefined;
    auth.login('laura@empresa.com', 'Clave1234').subscribe((u) => (result = u));

    const req = http.expectOne(`${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'laura@empresa.com', password: 'Clave1234' });
    req.flush({ access_token: token, token_type: 'bearer', user: USER } satisfies TokenResponse);

    expect(result?.email).toBe(USER.email);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isStaff()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).name).toBe('Laura Gómez');
  });

  it('registers a candidate', () => {
    const { auth, http } = setup();
    auth.register({ name: 'Juan', email: 'juan@mail.com', password: 'Clave1234', phone: null }).subscribe();
    const req = http.expectOne(`${API_URL}/auth/register`);
    req.flush({ access_token: fakeToken(inOneHour()), token_type: 'bearer', user: { ...USER, role: 'candidate', candidate_id: 7 } });
    expect(auth.role()).toBe('candidate');
    expect(auth.hasRole('candidate')).toBe(true);
    expect(auth.hasRole('admin', 'recruiter')).toBe(false);
  });

  it('restores a valid session but discards an expired one', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken(inOneHour()));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    expect(setup().auth.isLoggedIn()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) - 10));
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('ignores corrupted stored data', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken(inOneHour()));
    localStorage.setItem(USER_KEY, '{not json');
    expect(setup().auth.isLoggedIn()).toBe(false);
  });

  it('logs out and clears everything', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken(inOneHour()));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    const { auth } = setup();
    auth.logout(null);
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('follows a logout made in another tab', () => {
    localStorage.setItem(TOKEN_KEY, fakeToken(inOneHour()));
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    const { auth } = setup();
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY }));
    expect(auth.isLoggedIn()).toBe(false);
  });
});

describe('token helpers', () => {
  it('reads the expiry from the payload', () => {
    expect(tokenExpiry(fakeToken(123))).toBe(123);
    expect(tokenExpiry('garbage')).toBeNull();
    expect(isTokenExpired(fakeToken(inOneHour()))).toBe(false);
    expect(isTokenExpired(fakeToken(1))).toBe(true);
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('sends each role to its home', () => {
    expect(homeFor('admin')).toBe('/app');
    expect(homeFor('recruiter')).toBe('/app');
    expect(homeFor('candidate')).toBe('/portal');
    expect(homeFor(null)).toBe('/');
  });
});
