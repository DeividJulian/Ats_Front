/** One small service per backend resource. Each method maps to one endpoint of the API. */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../config/api.config';
import {
  AiEvaluation,
  AiStatus,
  Application,
  ApplicationStatus,
  Candidate,
  CandidateInput,
  CandidateInsights,
  InterviewGuide,
  Job,
  JobDraft,
  JobInput,
  JobRecommendation,
  JobStatus,
  MyApplication,
  ProfileInput,
  PublicJob,
  PublicSummary,
  RankingItem,
  ResumeAnalysis,
  StaffUserInput,
  Stats,
  Suggestion,
  User,
  UserUpdate,
} from '../models';

function pdfForm(file: File): FormData {
  const body = new FormData();
  body.append('file', file);
  return body;
}

@Injectable({ providedIn: 'root' })
export class PublicService {
  private readonly http = inject(HttpClient);

  jobs(): Observable<PublicJob[]> {
    return this.http.get<PublicJob[]>(`${API_URL}/public/jobs`);
  }

  job(id: number): Observable<PublicJob> {
    return this.http.get<PublicJob>(`${API_URL}/public/jobs/${id}`);
  }

  summary(): Observable<PublicSummary> {
    return this.http.get<PublicSummary>(`${API_URL}/public/summary`);
  }
}

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/jobs`;

  list(status?: JobStatus): Observable<Job[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<Job[]>(this.url, { params });
  }

  get(id: number): Observable<Job> {
    return this.http.get<Job>(`${this.url}/${id}`);
  }

  create(input: JobInput): Observable<Job> {
    return this.http.post<Job>(this.url, input);
  }

  update(id: number, input: JobInput): Observable<Job> {
    return this.http.put<Job>(`${this.url}/${id}`, input);
  }

  setStatus(id: number, status: JobStatus): Observable<Job> {
    return this.http.patch<Job>(`${this.url}/${id}/status`, { status });
  }

  remove(id: number): Observable<{ message: string; deleted_applications: number }> {
    return this.http.delete<{ message: string; deleted_applications: number }>(`${this.url}/${id}`);
  }

  ranking(id: number, blind = false): Observable<RankingItem[]> {
    return this.http.get<RankingItem[]>(`${this.url}/${id}/ranking`, { params: { blind } });
  }

  suggestedCandidates(id: number, limit = 5): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${this.url}/${id}/suggested-candidates`, { params: { limit } });
  }

  recalculateRanking(id: number): Observable<{ message: string; updated_applications: number }> {
    return this.http.post<{ message: string; updated_applications: number }>(`${this.url}/${id}/recalculate-ranking`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class CandidateService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/candidates`;

  list(skill?: string): Observable<Candidate[]> {
    const params = skill ? new HttpParams().set('skill', skill) : undefined;
    return this.http.get<Candidate[]>(this.url, { params });
  }

  get(id: number): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.url}/${id}`);
  }

  create(input: CandidateInput): Observable<Candidate> {
    return this.http.post<Candidate>(this.url, input);
  }

  update(id: number, input: CandidateInput): Observable<Candidate> {
    return this.http.put<Candidate>(`${this.url}/${id}`, input);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.url}/${id}`);
  }

  /** Creates a candidate from a PDF resume: the server detects name, email, phone and profile. */
  createFromResume(file: File): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.url}/from-resume`, pdfForm(file));
  }

  uploadResume(id: number, file: File): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.url}/${id}/resume`, pdfForm(file));
  }

  analyzeResume(file: File): Observable<ResumeAnalysis> {
    return this.http.post<ResumeAnalysis>(`${API_URL}/nlp/analyze-resume`, pdfForm(file));
  }

  insights(id: number): Observable<CandidateInsights> {
    return this.http.get<CandidateInsights>(`${this.url}/${id}/insights`);
  }

  recommendedJobs(id: number, limit = 5): Observable<JobRecommendation[]> {
    return this.http.get<JobRecommendation[]>(`${this.url}/${id}/recommended-jobs`, { params: { limit } });
  }
}

@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/applications`;

  list(filters: { job_id?: number; candidate_id?: number } = {}): Observable<Application[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) params = params.set(key, value);
    }
    return this.http.get<Application[]>(this.url, { params });
  }

  get(id: number): Observable<Application> {
    return this.http.get<Application>(`${this.url}/${id}`);
  }

  apply(jobId: number, candidateId: number): Observable<Application> {
    return this.http.post<Application>(this.url, { job_id: jobId, candidate_id: candidateId });
  }

  setStatus(id: number, status: ApplicationStatus): Observable<Application> {
    return this.http.patch<Application>(`${this.url}/${id}/status`, { status });
  }

  withdraw(id: number): Observable<unknown> {
    return this.http.delete(`${this.url}/${id}`);
  }

  recalculate(id: number): Observable<Application> {
    return this.http.post<Application>(`${this.url}/${id}/recalculate`, {});
  }

  interviewGuide(id: number): Observable<InterviewGuide> {
    return this.http.get<InterviewGuide>(`${this.url}/${id}/interview-guide`);
  }
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private readonly http = inject(HttpClient);

  get(): Observable<Stats> {
    return this.http.get<Stats>(`${API_URL}/stats`);
  }

  /** Loads the demo data (admins only). With reset=true it deletes what is there. */
  loadDemo(reset: boolean): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/seed`, {}, { params: { reset } });
  }
}

/** Features backed by the Claude language model (optional on the server). */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/ai`;

  status(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${this.url}/status`);
  }

  evaluate(applicationId: number): Observable<AiEvaluation> {
    return this.http.post<AiEvaluation>(`${this.url}/evaluate/${applicationId}`, {});
  }

  draftJob(title: string, notes: string): Observable<JobDraft> {
    return this.http.post<JobDraft>(`${this.url}/draft-job`, { title, notes });
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/users`;

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  create(input: StaffUserInput): Observable<User> {
    return this.http.post<User>(this.url, input);
  }

  update(id: number, changes: UserUpdate): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, changes);
  }

  remove(id: number): Observable<unknown> {
    return this.http.delete(`${this.url}/${id}`);
  }
}

/** The logged-in candidate's own data. */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/me`;

  profile(): Observable<Candidate> {
    return this.http.get<Candidate>(`${this.url}/profile`);
  }

  updateProfile(input: ProfileInput): Observable<Candidate> {
    return this.http.put<Candidate>(`${this.url}/profile`, input);
  }

  uploadResume(file: File): Observable<Candidate> {
    return this.http.post<Candidate>(`${this.url}/resume`, pdfForm(file));
  }

  insights(): Observable<CandidateInsights> {
    return this.http.get<CandidateInsights>(`${this.url}/insights`);
  }

  recommendedJobs(limit = 5): Observable<JobRecommendation[]> {
    return this.http.get<JobRecommendation[]>(`${this.url}/recommended-jobs`, { params: { limit } });
  }

  applications(): Observable<MyApplication[]> {
    return this.http.get<MyApplication[]>(`${this.url}/applications`);
  }

  apply(jobId: number): Observable<MyApplication> {
    return this.http.post<MyApplication>(`${this.url}/applications`, { job_id: jobId });
  }

  withdraw(applicationId: number): Observable<unknown> {
    return this.http.delete(`${this.url}/applications/${applicationId}`);
  }
}
