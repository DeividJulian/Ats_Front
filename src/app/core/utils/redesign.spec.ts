import { Briefcase } from 'lucide-angular';

import { navFor, sectionFor } from '../../layout/shell';
import { coverageLevel } from '../../pages/staff/dashboard/dashboard';
import { jobCode } from '../../pages/staff/job-detail/job-detail';
import { linkableCandidates } from '../../pages/staff/ranking-board/ranking-board';
import { resultsToCsv } from '../../pages/staff/bulk-analysis/bulk-analysis';
import { iconSvg } from '../../shared/icon';
import { Candidate } from '../models';
import { areaOf, isThisMonth, timeAgo } from './areas';

describe('areas and dates', () => {
  it('finds the main area of a list of skills', () => {
    expect(areaOf(['python', 'docker', 'excel'])).toBe('technology');
    expect(areaOf(['contabilidad', 'siigo', 'excel'])).toBe('administration');
    expect(areaOf(['ventas', 'crm', 'liderazgo'])).toBe('sales');
    expect(areaOf([])).toBe('general');
    expect(areaOf(['algo raro'])).toBe('general');
  });

  it('says how long ago something happened', () => {
    const now = new Date('2026-10-10T12:00:00Z').getTime();
    expect(timeAgo('2026-10-10T08:00:00Z', now)).toBe('hoy');
    expect(timeAgo('2026-10-09T08:00:00Z', now)).toBe('ayer');
    expect(timeAgo('2026-10-05T12:00:00Z', now)).toBe('hace 5 días');
    expect(timeAgo('2026-09-20T12:00:00Z', now)).toBe('hace 2 semanas');
    expect(timeAgo('2026-06-01T12:00:00Z', now)).toBe('hace 4 meses');
  });

  it('knows whether a date is in the current month', () => {
    const now = new Date('2026-10-10T12:00:00');
    expect(isThisMonth('2026-10-01T12:00:00', now)).toBe(true);
    expect(isThisMonth('2026-09-30T12:00:00', now)).toBe(false);
    expect(isThisMonth('2025-10-10T12:00:00', now)).toBe(false);
  });
});

describe('redesign helpers', () => {
  it('labels how covered a skill is', () => {
    expect(coverageLevel(60)).toEqual({ label: 'Cubierta 60%', kind: 'good' });
    expect(coverageLevel(30).kind).toBe('warn');
    expect(coverageLevel(5)).toEqual({ label: 'Brecha 5%', kind: 'bad' });
  });

  it('names the current section for the top bar', () => {
    const staff = navFor('admin');
    expect(sectionFor('/app', staff)).toBe('Panel');
    expect(sectionFor('/app/vacantes/3/editar', staff)).toBe('Vacantes');
    expect(sectionFor('/app/ranking?vacante=2', staff)).toBe('Ranking');
    expect(sectionFor('/portal/perfil', navFor('candidate'))).toBe('Mi perfil');
    expect(navFor('recruiter').map((n) => n.label)).toEqual(['Panel', 'Vacantes', 'Candidatos', 'Ranking', 'Análisis masivo']);
  });

  it('builds readable job codes', () => {
    expect(jobCode(7)).toBe('VAC-0007');
    expect(jobCode(1234)).toBe('VAC-1234');
  });

  it('offers only candidates who have not applied yet', () => {
    const c = (id: number, name: string, email: string) => ({ id, name, email }) as Candidate;
    const all = [c(1, 'Ana Ruiz', 'ana@x.com'), c(2, 'Luis Mora', 'luis@x.com'), c(3, 'Ana Gil', 'gil@x.com')];
    expect(linkableCandidates(all, new Set([1]), 'ana').map((x) => x.id)).toEqual([3]);
    expect(linkableCandidates(all, new Set(), 'LUIS@').map((x) => x.id)).toEqual([2]);
    expect(linkableCandidates(all, new Set([2]), '').map((x) => x.id)).toEqual([1, 3]);
  });

  it('exports results as a CSV Excel can open', () => {
    const csv = resultsToCsv([
      { name: 'Ana "La Pro"', score: 92.5, classification: 'high', matched: ['python', 'sql'], inferred: [], missing: ['docker'], years: 4, education: null, similarity: 0.3 },
    ]);
    const [header, row] = csv.split('\r\n');
    expect(header.split(';')).toHaveLength(8);
    expect(row).toBe('"1";"Ana ""La Pro""";"92.5";"Alto";"4";"python, sql";"";"docker"');
  });

  it('draws icons as SVG from the library data', () => {
    const svg = iconSvg(Briefcase, 20, 2);
    expect(svg).toContain('width="20"');
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('key=');
  });
});
