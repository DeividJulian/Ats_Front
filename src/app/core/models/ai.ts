import { EducationLevel } from './job';

export interface AiStatus {
  configured: boolean;
  /** gemini, groq or anthropic */
  provider: string;
  model: string;
}

export type AiRecommendation = 'advance' | 'interview_with_reservations' | 'reject';

export interface AiEvaluation {
  application_id: number;
  system_score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: AiRecommendation;
  interview_questions: string[];
}

export interface AiResumeProfile {
  skills: string[];
  experience_years: number;
  education_level: EducationLevel | null;
  summary: string;
}

export interface JobDraft {
  description: string;
  requirements: string;
  required_skills: string[];
  min_experience_years: number;
  min_education_level: EducationLevel | null;
}
