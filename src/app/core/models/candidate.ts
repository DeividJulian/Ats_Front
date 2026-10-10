import { EducationLevel } from './job';

export interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  resume_text: string;
  skills: string[];
  experience_years: number;
  education_level: EducationLevel | null;
  created_at: string;
}

export interface CandidateInput {
  name: string;
  email: string;
  phone: string | null;
  resume_text: string;
  skills: string[];
  /** null: the server infers it from the resume text */
  experience_years: number | null;
  education_level: EducationLevel | null;
}

export interface ProfileInput {
  name: string;
  phone: string | null;
  resume_text: string;
  skills: string[];
  experience_years: number | null;
  education_level: EducationLevel | null;
}

export interface ResumeAnalysis {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience_years: number;
  education_level: EducationLevel | null;
  key_terms: string[];
}
