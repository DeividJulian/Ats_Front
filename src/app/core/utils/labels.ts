/** Spanish texts for the codes the API uses. Everything the user reads comes from here. */
import { AiRecommendation, ApplicationStatus, Area, Classification, EducationLevel, JobStatus, QuestionType, Role } from '../models';

export const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: 'high_school', label: 'Bachiller' },
  { value: 'technician', label: 'Técnico' },
  { value: 'technologist', label: 'Tecnólogo' },
  { value: 'professional', label: 'Profesional' },
  { value: 'specialization', label: 'Especialización' },
  { value: 'masters', label: 'Maestría' },
  { value: 'doctorate', label: 'Doctorado' },
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Nuevo',
  shortlisted: 'Preseleccionado',
  interview: 'Entrevista',
  offer: 'Oferta',
  hired: 'Contratado',
  rejected: 'Rechazado',
};

/** Pipeline order shown to the user (rejected goes apart). */
export const PIPELINE: ApplicationStatus[] = ['new', 'shortlisted', 'interview', 'offer', 'hired'];

/** Same transitions the backend validates (services/pipeline.py). */
export const NEXT_STATUSES: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = { open: 'Abierta', closed: 'Cerrada' };

export const CLASSIFICATION_LABELS: Record<Classification, string> = { high: 'Alto', medium: 'Medio', low: 'Bajo' };

export const RECOMMENDATION_LABELS: Record<AiRecommendation, string> = {
  advance: 'Avanzar en el proceso',
  interview_with_reservations: 'Entrevistar con reservas',
  reject: 'Descartar',
};

export const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', recruiter: 'Reclutador', candidate: 'Candidato' };

export const AREA_LABELS: Record<Area, string> = {
  technology: 'Tecnología',
  administration: 'Administración y finanzas',
  sales: 'Comercial y mercadeo',
  soft_skills: 'Habilidades blandas',
  general: 'General',
};

export const BREAKDOWN_LABELS: Record<string, string> = {
  skills: 'Habilidades',
  text: 'Similitud del perfil',
  experience: 'Experiencia',
  education: 'Educación',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  strength: 'Fortaleza',
  inferred: 'Habilidad inferida',
  gap: 'Brecha',
  experience: 'Experiencia',
  area: 'Del área',
  motivation: 'Motivación',
};

/** Name of the AI provider reported by GET /ai/status. */
export const AI_PROVIDER_LABELS: Record<string, string> = { gemini: 'Gemini', groq: 'Groq', anthropic: 'Claude' };

function lookup<K extends string>(labels: Record<K, string>, code: string | null | undefined, fallback = '—'): string {
  if (!code) return fallback;
  return (labels as Record<string, string>)[code] ?? code;
}

export const educationLabel = (code: string | null | undefined) =>
  EDUCATION_LEVELS.find((l) => l.value === code)?.label ?? 'No indicado';
export const statusLabel = (code: string | null | undefined) => lookup(APPLICATION_STATUS_LABELS, code);
export const jobStatusLabel = (code: string | null | undefined) => lookup(JOB_STATUS_LABELS, code);
export const classificationLabel = (code: string | null | undefined) => lookup(CLASSIFICATION_LABELS, code);
export const roleLabel = (code: string | null | undefined) => lookup(ROLE_LABELS, code);
export const areaLabel = (code: string | null | undefined) => lookup(AREA_LABELS, code);
export const breakdownLabel = (code: string) => BREAKDOWN_LABELS[code] ?? code;
export const recommendationLabel = (code: string | null | undefined) => lookup(RECOMMENDATION_LABELS, code);
export const aiProviderLabel = (code: string | null | undefined) => (code && AI_PROVIDER_LABELS[code]) || 'la IA';
export const questionTypeLabel = (code: string | null | undefined) => lookup(QUESTION_TYPE_LABELS, code);
