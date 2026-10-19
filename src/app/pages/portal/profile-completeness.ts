import { Candidate } from '../../core/models';

export interface Completeness {
  pct: number;
  /** What is still missing, in words the candidate understands */
  missing: string[];
}

const CHECKS: { label: string; done: (c: Candidate) => boolean }[] = [
  { label: 'Sube tu hoja de vida o pega su texto', done: (c) => c.resume_text.trim().length >= 80 },
  { label: 'Agrega al menos 3 habilidades', done: (c) => c.skills.length >= 3 },
  { label: 'Indica tus años de experiencia', done: (c) => c.experience_years > 0 },
  { label: 'Indica tu nivel educativo', done: (c) => c.education_level !== null },
  { label: 'Agrega un teléfono de contacto', done: (c) => !!c.phone },
];

/** Every check with whether this profile passes it, for the checklist. */
export function profileChecklist(candidate: Candidate): { label: string; done: boolean }[] {
  return CHECKS.map((check) => ({ label: check.label, done: check.done(candidate) }));
}

/** How complete the profile is: the more complete, the better the recommendations. */
export function profileCompleteness(candidate: Candidate): Completeness {
  const missing = CHECKS.filter((check) => !check.done(candidate)).map((check) => check.label);
  return { pct: Math.round((100 * (CHECKS.length - missing.length)) / CHECKS.length), missing };
}
