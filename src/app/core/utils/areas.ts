import { Area } from '../models';
import { SKILL_AREAS } from '../workers/skills-catalog';

const AREA_BY_SKILL = new Map<string, Area>(
  Object.entries(SKILL_AREAS).flatMap(([area, skills]) => skills.map((s) => [s, area as Area] as const)),
);

/** Main professional area of a list of skills (the one most of them belong to), like the backend. */
export function areaOf(skills: string[]): Area {
  const counts = new Map<Area, number>();
  for (const skill of skills) {
    const area = AREA_BY_SKILL.get(skill) ?? 'general';
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  let best: Area = 'general';
  let bestCount = 0;
  for (const [area, count] of counts) {
    if (count > bestCount) {
      best = area;
      bestCount = count;
    }
  }
  return best;
}

/** "hoy", "ayer", "hace 5 días", "hace 2 semanas", "hace 3 meses". */
export function timeAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 14) return `hace ${days} días`;
  if (days < 60) return `hace ${Math.floor(days / 7)} semanas`;
  return `hace ${Math.floor(days / 30)} meses`;
}

/** True when the date falls in the current calendar month. */
export function isThisMonth(iso: string, now = new Date()): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}
