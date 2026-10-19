import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';

import { API_URL } from '../core/config/api.config';
import { Candidate, JobRecommendation, MyApplication, PublicJob } from '../core/models';
import { USER, fakeToken } from '../../testing/fixtures';
import { Login } from './auth/login';
import { passwordsMatch } from './auth/register';
import { Landing } from './landing/landing';
import { timeline } from './portal/applications/applications';
import { applicationCounts } from './portal/home/home';
import { jobsWithFit } from './portal/jobs/jobs';
import { profileChecklist, profileCompleteness } from './portal/profile-completeness';
import { parsePastedResumes } from './staff/bulk-analysis/bulk-analysis';

const JOB: PublicJob = {
  id: 1,
  title: 'Auxiliar Contable',
  description: 'Registro de facturas',
  requirements: 'Excel',
  required_skills: ['contabilidad', 'excel'],
  min_experience_years: 2,
  min_education_level: 'technician',
  created_at: '2026-10-10T00:00:00Z',
};

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return TestBed.inject(HttpTestingController);
}

describe('Landing page', () => {
  it('shows the open jobs, the numbers and filters by search', async () => {
    const backend = setup();
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    backend.expectOne(`${API_URL}/public/jobs`).flush([JOB, { ...JOB, id: 2, title: 'Desarrollador Python', required_skills: ['python'] }]);
    backend.expectOne(`${API_URL}/public/summary`).flush({ open_jobs: 2, candidates: 9, hires: 1 });
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('.job')).toHaveLength(2);
    expect(page.querySelector('.numbers')?.textContent).toContain('9');
    expect(page.textContent).toContain('Busco empleo');

    const search = page.querySelector<HTMLInputElement>('input.search')!;
    search.value = 'python';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(page.querySelectorAll('.job')).toHaveLength(1);
    expect(page.querySelector('.job h3')?.textContent).toContain('Desarrollador Python');
  });

  it('offers to retry when the server does not answer', async () => {
    const backend = setup();
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    backend.expectOne(`${API_URL}/public/jobs`).flush(null, { status: 0, statusText: 'Unknown Error' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reintentar');
  });
});

describe('Login page', () => {
  it('validates the fields before calling the server', async () => {
    const backend = setup();
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(page.textContent).toContain('Escribe un correo válido');
    backend.expectNone(`${API_URL}/auth/login`);
  });

  it('logs in with a demo account and goes to the role home', async () => {
    const backend = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const demo = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.demo button');
    expect(demo).toHaveLength(2);
    demo[0].click();

    const req = backend.expectOne(`${API_URL}/auth/login`);
    expect(req.request.body).toEqual({ email: 'reclutador@demo.com', password: 'Demo1234' });
    req.flush({ access_token: fakeToken(Math.floor(Date.now() / 1000) + 3600), token_type: 'bearer', user: USER });
    expect(navigate).toHaveBeenCalledWith('/app');
  });

  it('shows the server message when the password is wrong', async () => {
    const backend = setup();
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.demo button')[1].click();
    backend.expectOne(`${API_URL}/auth/login`).flush({ detail: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent).toContain('Correo o contraseña incorrectos');
  });
});

describe('page helpers', () => {
  it('checks that both passwords match', () => {
    const group = new FormGroup({ password: new FormControl('Clave1234'), confirm: new FormControl('Otra12345') });
    expect(passwordsMatch(group)).toEqual({ mismatch: true });
    group.controls.confirm.setValue('Clave1234');
    expect(passwordsMatch(group)).toBeNull();
  });

  it('draws the timeline of an application', () => {
    expect(timeline('interview').map((s) => s.state)).toEqual(['done', 'done', 'current', 'pending', 'pending']);
    expect(timeline('hired').at(-1)?.state).toBe('current');
    expect(timeline('rejected').every((s) => s.state === 'pending')).toBe(true);
  });

  it('measures how complete a profile is', () => {
    const empty: Candidate = {
      id: 1, name: 'Juan', email: 'j@m.com', phone: null, resume_text: '', skills: [],
      experience_years: 0, education_level: null, created_at: '',
    };
    expect(profileCompleteness(empty)).toEqual({ pct: 0, missing: expect.any(Array) });
    const full = { ...empty, phone: '300', resume_text: 'x'.repeat(100), skills: ['a', 'b', 'c'], experience_years: 2, education_level: 'professional' as const };
    expect(profileCompleteness(full)).toEqual({ pct: 100, missing: [] });
    expect(profileChecklist(empty).every((c) => !c.done)).toBe(true);
    expect(profileChecklist({ ...empty, phone: '300' }).filter((c) => c.done)).toHaveLength(1);
  });

  it('counts the candidate applications by stage', () => {
    const a = (status: MyApplication['status']) => ({ status }) as MyApplication;
    expect(applicationCounts([a('new'), a('interview'), a('offer'), a('shortlisted'), a('rejected'), a('hired')])).toEqual({
      total: 6, active: 4, interview: 2, shortlisted: 1,
    });
  });

  it('orders open jobs by the candidate fit and marks the ones already applied', () => {
    const fit = (job_id: number, score: number): JobRecommendation => ({
      job_id, title: '', score, classification: 'medium', matching_skills: [], missing_skills: [],
    });
    const applied = { job_id: 3, status: 'new' } as MyApplication;
    const items = jobsWithFit([JOB, { ...JOB, id: 2 }, { ...JOB, id: 3 }], [fit(1, 40), fit(2, 90)], [applied]);
    expect(items.map((i) => i.job.id)).toEqual([2, 1, 3]);
    expect(items[2].application?.status).toBe('new');
    expect(items[2].fit).toBeNull();
  });

  it('splits pasted resumes on lines with ---', () => {
    const resumes = parsePastedResumes('Ana Ruiz\nContadora\n---\nLuis Mora\nDesarrollador\n\n---\n\n');
    expect(resumes.map((r) => r.name)).toEqual(['Ana Ruiz', 'Luis Mora']);
  });
});
