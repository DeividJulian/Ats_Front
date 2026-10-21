import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_URL } from '../../../core/config/api.config';
import { Stats } from '../../../core/models';
import { Dashboard } from './dashboard';

const STATS: Stats = {
  totals: { jobs: 1, open_jobs: 1, candidates: 2, applications: 2 },
  funnel: { new: 2 }, hire_rate_pct: 0, per_job: [], most_demanded_skills: [], talent_gaps: [],
};

describe('Dashboard', () => {
  it('reloads the numbers and says when they were read', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const answer = () => {
      backend.match(`${API_URL}/stats`).forEach((r) => r.flush(STATS));
      backend.match(`${API_URL}/jobs`).forEach((r) => r.flush([]));
      backend.match(() => true).forEach((r) => r.flush({ configured: false, provider: 'groq', model: '' }));
    };
    answer();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Actualizado a las');

    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Actualizar'))!.click();
    expect(backend.match(`${API_URL}/stats`)).toHaveLength(1);
  });
});
