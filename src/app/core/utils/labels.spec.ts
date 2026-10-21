import { ApplicationStatus } from '../models';
import {
  APPLICATION_STATUS_LABELS,
  PIPELINE,
  STATUS_TONES,
  aiProviderLabel,
  areaLabel,
  breakdownLabel,
  classificationLabel,
  jobStatusLabel,
  statusBadge,
} from './labels';

describe('status colors', () => {
  it('gives every application status a design color', () => {
    const statuses = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];
    for (const status of statuses) expect(STATUS_TONES[status]).toBeTruthy();
    expect(statusBadge('interview')).toBe('badge badge--dot badge--entrevista');
    expect(statusBadge('hired')).toBe('badge badge--dot badge--contratado');
  });

  it('falls back to a neutral badge for an unknown status', () => {
    expect(statusBadge('archivado')).toBe('badge badge--dot badge--cerrada');
  });

  it('the pipeline ends with the hire and never includes the rejection', () => {
    expect(PIPELINE.at(-1)).toBe('hired');
    expect(PIPELINE).not.toContain('rejected');
  });
});

describe('labels', () => {
  it('names the AI provider reported by the server', () => {
    expect(aiProviderLabel('groq')).toBe('Groq');
    expect(aiProviderLabel('gemini')).toBe('Gemini');
    expect(aiProviderLabel('otro')).toBe('la IA');
    expect(aiProviderLabel(null)).toBe('la IA');
  });

  it('translates the codes of jobs, scores and areas', () => {
    expect(jobStatusLabel('closed')).toBe('Cerrada');
    expect(classificationLabel('medium')).toBe('Medio');
    expect(areaLabel('technology')).toBe('Tecnología');
    expect(breakdownLabel('text')).toBe('Similitud del perfil');
    // Unknown codes are shown as they come, and empty ones as a dash
    expect(jobStatusLabel('draft')).toBe('draft');
    expect(classificationLabel(undefined)).toBe('—');
  });
});
