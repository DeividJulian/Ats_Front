import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { API_URL } from '../core/config/api.config';
import { Candidate, JobRecommendation, MyApplication, PublicJob } from '../core/models';
import { USER, fakeToken } from '../../testing/fixtures';
import { Login } from './auth/login';
import { cleanCode } from './auth/code-step';
import { Landing } from './landing/landing';
import { timeline } from './portal/applications/applications';
import { applicationCounts } from './portal/home/home';
import { jobsWithFit } from './portal/jobs/jobs';
import { profileChecklist, profileCompleteness } from './portal/profile-completeness';
import { parsePastedResumes } from './staff/bulk-analysis/bulk-analysis';
import { averageScore, greetingFor } from './staff/dashboard/dashboard';
import { recommendationTone } from './staff/job-detail/application-review';
import { BREAKDOWN_COLUMNS, COLUMN_LABELS } from './staff/ranking/ranking';

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
  function open() {
    const backend = setup();
    const fixture = TestBed.createComponent(Login);
    return { backend, fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('validates the email before calling the server', async () => {
    const { backend, fixture, page } = open();
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(page.textContent).toContain('Escribe un correo válido');
    backend.expectNone(`${API_URL}/auth/login`);
  });

  it('asks for a code and then shows the code step', async () => {
    const { backend, fixture, page } = open();
    await fixture.whenStable();
    const input = page.querySelector<HTMLInputElement>('input[type=email]')!;
    input.value = 'Laura@Empresa.com';
    input.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = backend.expectOne(`${API_URL}/auth/login`);
    expect(req.request.body).toEqual({ email: 'laura@empresa.com' });
    req.flush({ message: 'Te enviamos un código', email: 'laura@empresa.com' });
    await fixture.whenStable();
    expect(page.textContent).toContain('Revisa tu correo');
    expect(page.querySelector('input[autocomplete=one-time-code]')).not.toBeNull();
  });

  it('shows the server message when the email has no account', async () => {
    const { backend, fixture, page } = open();
    await fixture.whenStable();
    const input = page.querySelector<HTMLInputElement>('input[type=email]')!;
    input.value = 'nadie@mail.com';
    input.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    backend.expectOne(`${API_URL}/auth/login`).flush({ detail: 'No hay una cuenta con ese correo: crea una primero' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')?.textContent).toContain('crea una primero');
  });

  it('has no demo account buttons', async () => {
    const { backend, fixture, page } = open();
    await fixture.whenStable();
    expect(page.querySelectorAll('.demo button')).toHaveLength(0);
    expect(page.textContent).not.toContain('Demo');
    backend.expectNone(`${API_URL}/auth/demo`);
  });
});

describe('page helpers', () => {
  it('keeps only the six digits of a typed or pasted code', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('Tu código: 98-76-54')).toBe('987654');
    expect(cleanCode('1234567')).toBe('123456');
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

  it('greets by the time of day and weights the average score', () => {
    expect(greetingFor(8)).toBe('Buenos días');
    expect(greetingFor(15)).toBe('Buenas tardes');
    expect(greetingFor(21)).toBe('Buenas noches');
    expect(averageScore([{ applications: 3, average_score: 80 }, { applications: 1, average_score: 40 }])).toBe(70);
    expect(averageScore([])).toBe(0);
  });

  it('colors the AI advice and names every comparison column', () => {
    expect(recommendationTone('advance')).toBe('alto');
    expect(recommendationTone('interview_with_reservations')).toBe('medio');
    expect(recommendationTone('reject')).toBe('bajo');
    expect(BREAKDOWN_COLUMNS.map((c) => COLUMN_LABELS[c])).toEqual(['Habilidades', 'Experiencia', 'Educación', 'Similitud']);
  });
});
