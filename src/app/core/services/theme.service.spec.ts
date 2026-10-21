import { TestBed } from '@angular/core/testing';

import { THEME_COLORS, THEME_KEY, ThemeService, initialTheme } from './theme.service';
import { scoreTone } from '../../shared/score-bar';

describe('theme', () => {
  it('keeps the saved choice and otherwise follows the system', () => {
    expect(initialTheme('dark', false)).toBe('dark');
    expect(initialTheme('light', true)).toBe('light');
    expect(initialTheme(null, true)).toBe('dark');
    expect(initialTheme('raro', false)).toBe('light');
  });
});

describe('score colors', () => {
  it('maps each classification to the design tone', () => {
    expect(scoreTone('high')).toBe('alto');
    expect(scoreTone('medium')).toBe('medio');
    expect(scoreTone('low')).toBe('bajo');
    expect(scoreTone(undefined)).toBe('bajo');
  });
});

describe('ThemeService', () => {
  function fakeSystem(dark: boolean) {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    vi.stubGlobal('matchMedia', () => ({ matches: dark, addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn) }));
    return (matches: boolean) => listeners.forEach((fn) => fn({ matches }));
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('is-dark');
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
  });
  afterEach(() => vi.unstubAllGlobals());

  it('follows the system live while the user has not chosen', () => {
    const switchSystem = fakeSystem(false);
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('light');
    switchSystem(true);
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('is-dark')).toBe(true);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(THEME_COLORS.dark);
  });

  it('keeps the user choice when the system changes', () => {
    const switchSystem = fakeSystem(false);
    const theme = TestBed.inject(ThemeService);
    theme.toggle();
    switchSystem(false);
    expect(theme.theme()).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
