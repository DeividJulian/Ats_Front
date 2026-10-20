import { passwordStrength } from '../pages/auth/register';
import { paragraphs } from '../pages/public-job/public-job';
import { timeAgo } from './ago.pipe';
import { yearsLabel } from './years.pipe';

describe('timeAgo', () => {
  const now = new Date('2026-10-19T12:00:00Z').getTime();
  const before = (ms: number) => new Date(now - ms).toISOString();
  const HOUR = 3600_000;
  const DAY = 24 * HOUR;

  it('says how long ago in Spanish', () => {
    expect(timeAgo(before(30_000), now)).toBe('Ahora');
    expect(timeAgo(before(12 * 60_000), now)).toBe('Hace 12 min');
    expect(timeAgo(before(3 * HOUR), now)).toBe('Hace 3 h');
    expect(timeAgo(before(DAY), now)).toBe('Ayer');
    expect(timeAgo(before(4 * DAY), now)).toBe('Hace 4 días');
    expect(timeAgo(before(8 * DAY), now)).toBe('Hace 1 semana');
    expect(timeAgo(before(70 * DAY), now)).toBe('Hace 2 meses');
    expect(timeAgo(before(400 * DAY), now)).toBe('Hace 1 año');
  });

  it('ignores empty or broken dates', () => {
    expect(timeAgo(null, now)).toBe('');
    expect(timeAgo('no es fecha', now)).toBe('');
  });
});

describe('form helpers', () => {
  it('rates the password strength from 0 to 4', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('Abcdefgh1')).toBe(3);
    expect(passwordStrength('Abcdefgh1!')).toBe(4);
  });

  it('splits a job text into paragraphs', () => {
    expect(paragraphs('Uno\n\n  Dos  \n')).toEqual(['Uno', 'Dos']);
    expect(paragraphs(null)).toEqual([]);
  });
});

describe('yearsLabel', () => {
  it('uses singular for one year', () => {
    expect(yearsLabel(1)).toBe('1 año');
    expect(yearsLabel(3)).toBe('3 años');
    expect(yearsLabel(null)).toBe('0 años');
  });
});
