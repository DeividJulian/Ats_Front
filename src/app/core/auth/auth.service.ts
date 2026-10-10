import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { API_URL } from '../config/api.config';
import { RegisterInput, Role, TokenResponse, User } from '../models';
import { clearApiCache } from '../workers/api-cache';

export const TOKEN_KEY = 'ats.token';
export const USER_KEY = 'ats.user';

/** Seconds since epoch when the token expires, read from its payload (no signature check: the server does that). */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, now = Date.now()): boolean {
  const exp = tokenExpiry(token);
  return exp === null || exp * 1000 <= now;
}

/** Where each role lands after logging in. */
export function homeFor(role: Role | null | undefined): string {
  if (role === 'candidate') return '/portal';
  if (role === 'admin' || role === 'recruiter') return '/app';
  return '/';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly isLoggedIn = computed(() => this.token() !== null && this.user() !== null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isStaff = computed(() => this.role() === 'admin' || this.role() === 'recruiter');
  readonly isAdmin = computed(() => this.role() === 'admin');

  constructor() {
    this.restore();
    // Logging out (or in) in one tab is reflected in the others
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === TOKEN_KEY || event.key === USER_KEY) this.restore();
      });
    }
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<TokenResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(tap((r) => this.save(r)), map((r) => r.user));
  }

  register(input: RegisterInput): Observable<User> {
    return this.http
      .post<TokenResponse>(`${API_URL}/auth/register`, input)
      .pipe(tap((r) => this.save(r)), map((r) => r.user));
  }

  /** Reloads the user from the server (for example after editing the profile name). */
  refresh(): Observable<User> {
    return this.http.get<User>(`${API_URL}/auth/me`).pipe(
      tap((user) => {
        this.user.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }),
    );
  }

  logout(redirectTo: string | null = '/login'): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    // Data saved for offline use belongs to this user: it must not survive the session
    void clearApiCache();
    if (redirectTo) void this.router.navigateByUrl(redirectTo);
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  private save(response: TokenResponse): void {
    void clearApiCache();
    localStorage.setItem(TOKEN_KEY, response.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.token.set(response.access_token);
    this.user.set(response.user);
  }

  private restore(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    let user: User | null = null;
    try {
      user = rawUser ? (JSON.parse(rawUser) as User) : null;
    } catch {
      user = null;
    }
    if (!token || !user || isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      this.token.set(null);
      this.user.set(null);
      return;
    }
    this.token.set(token);
    this.user.set(user);
  }
}
