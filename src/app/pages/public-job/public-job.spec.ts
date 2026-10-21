import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_URL } from '../../core/config/api.config';
import { TOKEN_KEY, USER_KEY } from '../../core/auth/auth.service';
import { MyApplication, PublicJob } from '../../core/models';
import { USER, fakeToken } from '../../../testing/fixtures';
import { PublicJobPage } from './public-job';

const JOB: PublicJob = {
  id: 3, title: 'Auxiliar Contable', description: 'Registro de facturas', requirements: 'Excel',
  required_skills: ['excel'], min_experience_years: 1, min_education_level: null, created_at: '2026-10-10T00:00:00Z',
};

async function open(role: 'candidate' | null, applications: Partial<MyApplication>[] = []) {
  localStorage.clear();
  if (role) {
    localStorage.setItem(TOKEN_KEY, fakeToken(Math.floor(Date.now() / 1000) + 3600));
    localStorage.setItem(USER_KEY, JSON.stringify({ ...USER, role, candidate_id: 7 }));
  }
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const backend = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PublicJobPage);
  fixture.componentRef.setInput('id', '3');
  fixture.detectChanges();
  if (role) backend.expectOne(`${API_URL}/me/applications`).flush(applications);
  backend.expectOne(`${API_URL}/public/jobs/3`).flush(JOB);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Public job page', () => {
  it('tells a candidate who already applied, instead of offering the button again', async () => {
    const page = await open('candidate', [{ id: 1, job_id: 3, status: 'new' }]);
    expect(page.textContent).toContain('te postulaste');
    expect(page.textContent).not.toContain('Postularme');
  });

  it('offers to apply when the candidate has not applied yet', async () => {
    const page = await open('candidate', [{ id: 1, job_id: 9, status: 'new' }]);
    expect(page.textContent).toContain('Postularme');
  });

  it('asks visitors to create an account', async () => {
    const page = await open(null);
    expect(page.textContent).toContain('Crear cuenta y postularme');
  });
});
