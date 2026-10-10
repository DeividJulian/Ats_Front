export type EducationLevel =
  | 'high_school'
  | 'technician'
  | 'technologist'
  | 'professional'
  | 'specialization'
  | 'masters'
  | 'doctorate';

export type JobStatus = 'open' | 'closed';

export interface Job {
  id: number;
  title: string;
  description: string;
  requirements: string;
  required_skills: string[];
  min_experience_years: number;
  min_education_level: EducationLevel | null;
  status: JobStatus;
  created_at: string;
}

export interface JobInput {
  title: string;
  description: string;
  requirements: string;
  required_skills: string[];
  min_experience_years: number;
  min_education_level: EducationLevel | null;
}

/** Open job as shown to anyone, without internal data. */
export type PublicJob = Omit<Job, 'status'>;

export interface PublicSummary {
  open_jobs: number;
  candidates: number;
  hires: number;
}
