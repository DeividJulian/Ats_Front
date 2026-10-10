import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { API_URL } from '../config/api.config';
import { authInterceptor } from './auth.interceptor';
import { AuthService, TOKEN_KEY, USER_KEY } from './auth.service';
import { USER, fakeToken } from '../../../testing/fixtures';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const token = fakeToken(Math.floor(Date.now() / 1000) + 3600);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(USER));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  it('adds the token to requests to our backend', () => {
    http.get(`${API_URL}/jobs`).subscribe();
    expect(backend.expectOne(`${API_URL}/jobs`).request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('never sends the token to other sites', () => {
    http.get('https://otro-sitio.com/datos').subscribe();
    expect(backend.expectOne('https://otro-sitio.com/datos').request.headers.has('Authorization')).toBe(false);
  });

  it('closes the session when the server answers 401', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http.get(`${API_URL}/jobs`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/jobs`).flush({ detail: 'expiró' }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login?expired=1');
  });

  it('keeps the session on a 403 (it is a permission problem, not an expired session)', () => {
    http.get(`${API_URL}/users`).subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/users`).flush({ detail: 'No tienes permiso' }, { status: 403, statusText: 'Forbidden' });
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
  });

  it('a wrong password on the login page does not log anyone out', () => {
    http.post(`${API_URL}/auth/login`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/auth/login`).flush({ detail: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
  });
});
