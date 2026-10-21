import { TestBed } from '@angular/core/testing';

import { ScoreBar } from './score-bar';

async function render(score: number, classification: string, showLabel = true) {
  const fixture = TestBed.createComponent(ScoreBar);
  fixture.componentRef.setInput('score', score);
  fixture.componentRef.setInput('classification', classification);
  fixture.componentRef.setInput('showLabel', showLabel);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ScoreBar', () => {
  it('shows the score, its color and its classification', async () => {
    const page = await render(88, 'high');
    expect(page.querySelector('.score')?.classList).toContain('score--alto');
    expect(page.querySelector('.score__value')?.textContent).toContain('88');
    expect(page.querySelector('.badge')?.textContent).toBe('Alto');
    expect(page.querySelector<HTMLElement>('.score__fill')!.style.width).toBe('88%');
  });

  it('reads the result aloud for screen readers', async () => {
    const page = await render(42.5, 'low');
    expect(page.querySelector('[role=img]')?.getAttribute('aria-label')).toBe('Ajuste 42.5 de 100, Bajo');
  });

  it('can hide the classification badge', async () => {
    const page = await render(60, 'medium', false);
    expect(page.querySelector('.badge')).toBeNull();
    expect(page.querySelector('.score')?.classList).toContain('score--medio');
  });
});
