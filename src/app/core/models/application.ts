export type ApplicationStatus = 'new' | 'shortlisted' | 'interview' | 'offer' | 'hired' | 'rejected';
export type Classification = 'high' | 'medium' | 'low';

export interface MatchDetails {
  score: number;
  classification: Classification;
  breakdown: Record<string, number>;
  matching_skills: string[];
  inferred_skills?: Record<string, string>;
  missing_skills: string[];
  explanation: string[];
}

export interface Application {
  id: number;
  job_id: number;
  candidate_id: number;
  score: number;
  details: MatchDetails;
  status: ApplicationStatus;
  created_at: string;
}

export interface RankingItem {
  position: number;
  application_id: number;
  candidate_id: number;
  name: string;
  email: string | null;
  score: number;
  classification: Classification;
  status: ApplicationStatus;
  matching_skills: string[];
  missing_skills: string[];
}

export interface Suggestion {
  candidate_id: number;
  name: string;
  email: string;
  score: number;
  classification: Classification;
  matching_skills: string[];
  missing_skills: string[];
}

export interface JobRecommendation {
  job_id: number;
  title: string;
  score: number;
  classification: Classification;
  matching_skills: string[];
  missing_skills: string[];
}

/** A candidate's own application (the score is only for recruiters). */
export interface MyApplication {
  id: number;
  job_id: number;
  job_title: string;
  job_status: string;
  status: ApplicationStatus;
  matching_skills: string[];
  missing_skills: string[];
  created_at: string;
}
