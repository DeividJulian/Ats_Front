import { Classification } from './application';

export type Area = 'technology' | 'administration' | 'sales' | 'soft_skills' | 'general';

export interface CandidateInsights {
  candidate_id: number;
  name: string;
  summary: string;
  main_area: Area;
  skills_by_area: Record<string, string[]>;
  inferred_skills: Record<string, string>;
  skills_to_develop: { skill: string; open_jobs_requiring: number; suggestion: string }[];
}

export type QuestionType = 'strength' | 'inferred' | 'gap' | 'experience' | 'area' | 'motivation';

export interface InterviewGuide {
  application_id: number;
  candidate_name: string;
  job_title: string;
  score: number;
  classification: Classification;
  focus: string;
  strengths: string[];
  gaps: string[];
  questions: { type: QuestionType; question: string }[];
  training_for_gaps: { skill: string; suggestion: string }[];
}

export interface SkillCount {
  skill: string;
  jobs: number;
  candidates_with_skill: number;
}

export interface Stats {
  totals: { jobs: number; open_jobs: number; candidates: number; applications: number };
  funnel: Record<string, number>;
  hire_rate_pct: number;
  per_job: { job_id: number; title: string; status: string; applications: number; average_score: number; max_score: number }[];
  most_demanded_skills: SkillCount[];
  talent_gaps: SkillCount[];
}
