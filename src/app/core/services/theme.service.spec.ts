import { initialTheme } from './theme.service';
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
