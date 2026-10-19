import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'ats.theme';

/** The saved choice, or the system preference when the user never chose. */
export function initialTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') return saved;
  return prefersDark ? 'dark' : 'light';
}

/** Light and dark mode: the class .is-dark on <html> switches the design tokens. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('light');

  constructor() {
    if (typeof window === 'undefined') return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      // Storage blocked: follow the system
    }
    this.apply(initialTheme(saved, window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not saved, but it still changes for this visit
    }
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.classList.toggle('is-dark', theme === 'dark');
  }
}
