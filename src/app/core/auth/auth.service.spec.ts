import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

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

function storeSession(token = fakeToken(inOneHour()), user: User = USER) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('starts without a session', () => {
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.role()).toBeNull();
  });

  it('asks for a login code without opening a session', () => {
    const { auth, http } = setup();
    auth.requestCode('laura@empresa.com').subscribe();
    const req = http.expectOne(`${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'laura@empresa.com' });
    req.flush({ message: 'Te enviamos un código para entrar', email: 'laura@empresa.com' });
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('registers a candidate without a password and without opening a session', () => {
    const { auth, http } = setup();
    let sentTo = '';
    auth.register({ name: 'Juan', email: 'juan@mail.com', phone: null }).subscribe((r) => (sentTo = r.email));
    const req = http.expectOne(`${API_URL}/auth/register`);
    expect(req.request.body).toEqual({ name: 'Juan', email: 'juan@mail.com', phone: null });
    req.flush({ message: 'Te enviamos un código', email: 'juan@mail.com' });
    expect(sentTo).toBe('juan@mail.com');
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('trades the code for a session and keeps it in localStorage', () => {
    const { auth, http } = setup();
    const token = fakeToken(inOneHour());
    let result: User | undefined;
    auth.verify('laura@empresa.com', '123456').subscribe((u) => (result = u));

    const req = http.expectOne(`${API_URL}/auth/verify`);
    expect(req.request.body).toEqual({ email: 'laura@empresa.com', code: '123456' });
    req.flush({ access_token: token, token_type: 'bearer', user: USER } satisfies TokenResponse);

    expect(result?.email).toBe(USER.email);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isStaff()).toBe(true);
    expect(auth.isAdmin()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).name).toBe('Laura Gómez');
  });

  it('a wrong code leaves no session', () => {
    const { auth, http } = setup();
    auth.verify('laura@empresa.com', '000000').subscribe({ error: () => undefined });
    http.expectOne(`${API_URL}/auth/verify`).flush({ detail: 'Código incorrecto' }, { status: 400, statusText: 'Bad Request' });
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('enters a demo account and reads the login options', () => {
    const { auth, http } = setup();
    let demo = false;
    auth.options().subscribe((o) => (demo = o.demo_login));
    http.expectOne(`${API_URL}/auth/options`).flush({ demo_login: true });
    expect(demo).toBe(true);

    auth.demo('candidate').subscribe();
    const req = http.expectOne(`${API_URL}/auth/demo`);
    expect(req.request.body).toEqual({ account: 'candidate' });
    req.flush({ access_token: fakeToken(inOneHour()), token_type: 'bearer', user: { ...USER, role: 'candidate', candidate_id: 7 } });
    expect(auth.role()).toBe('candidate');
    expect(auth.hasRole('candidate')).toBe(true);
    expect(auth.hasRole('admin', 'recruiter')).toBe(false);
  });

  it('confirms the saved session with the server when the app opens', () => {
    storeSession();
    const { auth, http } = setup();
    auth.refreshProfile();
    http.expectOne(`${API_URL}/auth/me`).flush({ ...USER, name: 'Laura G. Gómez' });
    expect(auth.user()?.name).toBe('Laura G. Gómez');
    expect(JSON.parse(localStorage.getItem(USER_KEY)!).name).toBe('Laura G. Gómez');
  });

  it('does not call the server to refresh when there is no session', () => {
    const { auth, http } = setup();
    auth.refreshProfile();
    http.expectNone(`${API_URL}/auth/me`);
  });

  it('restores a valid session but discards an expired one', () => {
    storeSession();
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

  it('keeps working when localStorage is blocked', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const { auth, http } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    auth.verify('laura@empresa.com', '123456').subscribe();
    http.expectOne(`${API_URL}/auth/verify`).flush({ access_token: fakeToken(inOneHour()), token_type: 'bearer', user: USER });
    expect(auth.isLoggedIn()).toBe(true);
    auth.logout(null);
    expect(auth.isLoggedIn()).toBe(false);
    get.mockRestore();
    set.mockRestore();
    remove.mockRestore();
  });

  it('logs out, clears everything and goes to the login', () => {
    storeSession();
    const { auth } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('deletes the API answers saved by the Service Worker on logout', async () => {
    const deleted: string[] = [];
    const fakeCaches = {
      keys: async () => ['ats-api-v1', 'ats-app-v3'],
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      },
    };
    vi.stubGlobal('caches', fakeCaches);
    storeSession();
    const { auth } = setup();
    auth.logout(null);
    await new Promise((r) => setTimeout(r));
    expect(deleted.some((n) => n.includes('api'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('follows a logout made in another tab', () => {
    storeSession();
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
