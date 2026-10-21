import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'ats.theme';
/** Page background of each theme (--c-bg), for the browser bar. */
export const THEME_COLORS: Record<Theme, string> = { light: '#f7f5f1', dark: '#13110f' };

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
    const system = window.matchMedia?.('(prefers-color-scheme: dark)');
    this.apply(initialTheme(saved, system?.matches ?? false));
    // Without a choice of their own, the page follows the system when it switches (for example at sunset)
    system?.addEventListener?.('change', (event) => {
      if (!this.hasSavedChoice()) this.apply(event.matches ? 'dark' : 'light');
    });
  }

  private hasSavedChoice(): boolean {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'light' || saved === 'dark';
    } catch {
      return false;
    }
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
    // The browser bar on phones takes the color of the page
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }
}
