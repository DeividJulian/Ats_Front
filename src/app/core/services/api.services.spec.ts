import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '../config/api.config';
import {
  AiService,
  ApplicationService,
  CandidateService,
  JobService,
  PortalService,
  PublicService,
  StatsService,
  UserService,
} from './api.services';

// Each service method must hit the exact endpoint of the backend API.
describe('API services', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('PublicService reads the job board without a session', () => {
    const api = TestBed.inject(PublicService);
    api.jobs().subscribe();
    api.job(3).subscribe();
    api.summary().subscribe();
    backend.expectOne(`${API_URL}/public/jobs`).flush([]);
    backend.expectOne(`${API_URL}/public/jobs/3`).flush({});
    backend.expectOne(`${API_URL}/public/summary`).flush({});
  });

  it('JobService', () => {
    const api = TestBed.inject(JobService);
    api.list('open').subscribe();
    backend.expectOne(`${API_URL}/jobs?status=open`).flush([]);
    api.setStatus(2, 'closed').subscribe();
    const status = backend.expectOne(`${API_URL}/jobs/2/status`);
    expect(status.request.method).toBe('PATCH');
    expect(status.request.body).toEqual({ status: 'closed' });
    status.flush({});
    api.ranking(2, true).subscribe();
    backend.expectOne(`${API_URL}/jobs/2/ranking?blind=true`).flush([]);
    api.suggestedCandidates(2, 10).subscribe();
    backend.expectOne(`${API_URL}/jobs/2/suggested-candidates?limit=10`).flush([]);
    api.recalculateRanking(2).subscribe();
    expect(backend.expectOne(`${API_URL}/jobs/2/recalculate-ranking`).request.method).toBe('POST');
  });

  it('CandidateService sends PDFs as the "file" form field', () => {
    const api = TestBed.inject(CandidateService);
    const pdf = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    api.createFromResume(pdf).subscribe();
    const req = backend.expectOne(`${API_URL}/candidates/from-resume`);
    expect((req.request.body as FormData).get('file')).toBe(pdf);
    req.flush({});
    api.uploadResume(4, pdf).subscribe();
    backend.expectOne(`${API_URL}/candidates/4/resume`).flush({});
    api.analyzeResume(pdf).subscribe();
    backend.expectOne(`${API_URL}/nlp/analyze-resume`).flush({});
    api.list('Postgres').subscribe();
    backend.expectOne(`${API_URL}/candidates?skill=Postgres`).flush([]);
    api.insights(4).subscribe();
    backend.expectOne(`${API_URL}/candidates/4/insights`).flush({});
    api.recommendedJobs(4, 3).subscribe();
    backend.expectOne(`${API_URL}/candidates/4/recommended-jobs?limit=3`).flush([]);
  });

  it('ApplicationService', () => {
    const api = TestBed.inject(ApplicationService);
    api.apply(1, 2).subscribe();
    expect(backend.expectOne(`${API_URL}/applications`).request.body).toEqual({ job_id: 1, candidate_id: 2 });
    api.list({ candidate_id: 2 }).subscribe();
    backend.expectOne(`${API_URL}/applications?candidate_id=2`).flush([]);
    api.setStatus(5, 'interview').subscribe();
    expect(backend.expectOne(`${API_URL}/applications/5/status`).request.body).toEqual({ status: 'interview' });
    api.interviewGuide(5).subscribe();
    backend.expectOne(`${API_URL}/applications/5/interview-guide`).flush({});
  });

  it('StatsService, AiService and UserService', () => {
    TestBed.inject(StatsService).loadDemo(true).subscribe();
    backend.expectOne(`${API_URL}/seed?reset=true`).flush({});
    TestBed.inject(AiService).draftJob('Auxiliar', 'pyme').subscribe();
    expect(backend.expectOne(`${API_URL}/ai/draft-job`).request.body).toEqual({ title: 'Auxiliar', notes: 'pyme' });
    TestBed.inject(UserService).update(3, { is_active: false }).subscribe();
    const req = backend.expectOne(`${API_URL}/users/3`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('PortalService works on the logged-in candidate', () => {
    const api = TestBed.inject(PortalService);
    api.apply(9).subscribe();
    expect(backend.expectOne(`${API_URL}/me/applications`).request.body).toEqual({ job_id: 9 });
    api.withdraw(4).subscribe();
    expect(backend.expectOne(`${API_URL}/me/applications/4`).request.method).toBe('DELETE');
    api.recommendedJobs(50).subscribe();
    backend.expectOne(`${API_URL}/me/recommended-jobs?limit=50`).flush([]);
  });
});
