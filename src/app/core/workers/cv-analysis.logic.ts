/**
 * Pure logic of the bulk resume analysis (NLP + TF-IDF + score), the same algorithm as the backend.
 * It touches neither the DOM nor Angular, so it can run inside a Web Worker or, to compare, on the main thread.
 */
import { IMPLIED_SKILLS, SKILLS_CATALOG, STOPWORDS } from './skills-catalog';

export type EducationKey =
  | 'high_school'
  | 'technician'
  | 'technologist'
  | 'professional'
  | 'specialization'
  | 'masters'
  | 'doctorate';

export type Classification = 'high' | 'medium' | 'low';

export interface AnalysisJobSpec {
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string[];
  minYears: number;
  minEducation: EducationKey | null;
}

export interface ResumeInput {
  name: string;
  text: string;
}

export interface AnalysisJob {
  job: AnalysisJobSpec;
  /** Resumes pasted by the user or brought from the system */
  resumes: ResumeInput[];
  /** When > 0, synthetic resumes are generated inside the same process (load test) */
  syntheticCount: number;
}

export interface ResumeResult {
  name: string;
  score: number;
  classification: Classification;
  matched: string[];
  inferred: string[];
  missing: string[];
  years: number;
  education: EducationKey | null;
  similarity: number;
}

export interface PercentileGroup {
  /** 1, 5 or 10: the best X% of the batch */
  pct: number;
  count: number;
  /** Lowest score inside the group */
  minScore: number;
}

export interface AnalysisOutput {
  total: number;
  /** Best results, already sorted (enough to show and to export) */
  top: ResumeResult[];
  percentiles: PercentileGroup[];
  counts: Record<Classification, number>;
  averageScore: number;
  elapsedMs: number;
}

const WEIGHTS = { skills: 0.5, text: 0.2, experience: 0.2, education: 0.1 };
const REFERENCE_COSINE = 0.3;
const INFERRED_SKILL_CREDIT = 0.75;
const TOP_LIMIT = 200;
const PERCENTILES = [1, 5, 10];

export const EDUCATION_RANK: Record<EducationKey, number> = {
  high_school: 1,
  technician: 2,
  technologist: 3,
  professional: 4,
  specialization: 5,
  masters: 6,
  doctorate: 7,
};

const EDUCATION_KEYWORDS: [EducationKey, string[]][] = [
  ['doctorate', ['doctorado', 'phd']],
  ['masters', ['maestria', 'magister', 'master']],
  ['specialization', ['especializacion', 'especialista en']],
  [
    'professional',
    ['ingenier', 'licenciad', 'universitari', 'pregrado', 'contador publico', 'administrador de', 'abogad', 'psicolog', 'profesional en', 'economista'],
  ],
  ['technologist', ['tecnologo', 'tecnologia en']],
  ['technician', ['tecnico']],
  ['high_school', ['bachiller']],
];

const EXPERIENCE_PATTERNS = [
  /(\d{1,2})\s*\+?\s*(?:anos?|years?)\s+(?:de\s+)?(?:experiencia|exp)/g,
  /experiencia\s+(?:laboral\s+)?(?:de\s+|mayor a\s+|superior a\s+)?(?:mas de\s+)?(\d{1,2})\s*\+?\s*(?:anos?|years?)/g,
];

// ---------- Text ----------

/** Lowercase without accents. "Ingeniería" -> "ingenieria". */
export function normalize(text: string | null | undefined): string {
  return (text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -1);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function tokenize(text: string | null | undefined): string[] {
  const tokens: string[] = [];
  for (const raw of normalize(text).match(/[a-z0-9+#.]+/g) ?? []) {
    const word = raw.replace(/^\.+|\.+$/g, '');
    if (word.length < 2 || /^\d+$/.test(word) || STOPWORDS.has(word)) continue;
    tokens.push(stem(word));
  }
  return tokens;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Patterns compiled once. The lookarounds keep "java" from matching inside "javascript".
const SKILL_PATTERNS: [string, RegExp][] = [];
const SYNONYM_TO_CANONICAL = new Map<string, string>();
for (const [canonical, synonyms] of Object.entries(SKILLS_CATALOG)) {
  for (const synonym of synonyms) {
    const normal = normalize(synonym);
    SKILL_PATTERNS.push([canonical, new RegExp(`(?<![a-z0-9+#.])${escapeRegex(normal)}(?![a-z0-9+#])`)]);
    SYNONYM_TO_CANONICAL.set(normal, canonical);
  }
}

/** Alphabetical order ignoring accents, like the backend. */
export function sortSkills(skills: Iterable<string>): string[] {
  return [...new Set(skills)].sort((a, b) => (normalize(a) < normalize(b) ? -1 : normalize(a) > normalize(b) ? 1 : 0));
}

export function canonicalizeSkills(skills: string[]): string[] {
  const result: string[] = [];
  for (const skill of skills) {
    const clean = normalize(skill).trim();
    if (clean) result.push(SYNONYM_TO_CANONICAL.get(clean) ?? clean);
  }
  return sortSkills(result);
}

export function extractSkills(text: string): string[] {
  const normal = normalize(text);
  const found: string[] = [];
  for (const [canonical, pattern] of SKILL_PATTERNS) {
    if (pattern.test(normal)) found.push(canonical);
  }
  return sortSkills(found);
}

/** Skills implied by the given ones that are not already present, as {inferred: source}. */
export function inferSkills(skills: Iterable<string>): Map<string, string> {
  const known = new Set(skills);
  const inferred = new Map<string, string>();
  const pending = [...known].sort();
  while (pending.length) {
    const source = pending.pop()!;
    for (const implied of IMPLIED_SKILLS[source] ?? []) {
      if (!known.has(implied) && !inferred.has(implied)) {
        inferred.set(implied, inferred.get(source) ?? source);
        pending.push(implied);
      }
    }
  }
  return inferred;
}

export function extractYears(text: string): number {
  const normal = normalize(text);
  const values: number[] = [];
  for (const pattern of EXPERIENCE_PATTERNS) {
    for (const match of normal.matchAll(pattern)) values.push(parseInt(match[1], 10));
  }
  const valid = values.filter((v) => v >= 0 && v <= 45);
  return valid.length ? Math.max(...valid) : 0;
}

export function extractEducation(text: string): EducationKey | null {
  const normal = normalize(text);
  for (const [level, keywords] of EDUCATION_KEYWORDS) {
    if (keywords.some((k) => normal.includes(k))) return level;
  }
  return null;
}

// ---------- TF-IDF ----------

type Vector = Map<string, number>;

export function buildIdf(documents: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of documents) {
    for (const token of new Set(tokens)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const n = documents.length;
  const idf = new Map<string, number>();
  // Smoothed IDF: never zero and never divides by zero
  for (const [token, count] of df) idf.set(token, Math.log((1 + n) / (1 + count)) + 1);
  return idf;
}

export function tfidfVector(tokens: string[], idf: Map<string, number>): Vector {
  const vector: Vector = new Map();
  if (!tokens.length) return vector;
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const [t, c] of counts) vector.set(t, (c / tokens.length) * (idf.get(t) ?? 1));
  return vector;
}

export function cosine(a: Vector, b: Vector): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  for (const [t, v] of a) dot += v * (b.get(t) ?? 0);
  const norm = (v: Vector) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  const na = norm(a);
  const nb = norm(b);
  return na && nb ? dot / (na * nb) : 0;
}

// ---------- Score ----------

export function classify(score: number): Classification {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Scores one resume against the job. The TF-IDF vector of the job is computed once for the whole batch. */
export function scoreResume(
  job: AnalysisJobSpec,
  resume: ResumeInput,
  jobVector: Vector,
  idf: Map<string, number>,
): ResumeResult {
  const required = new Set(job.requiredSkills);
  const skills = extractSkills(resume.text);
  const own = new Set(skills);
  const matched = sortSkills([...required].filter((s) => own.has(s)));
  const inferredMap = inferSkills(own);
  const inferred = sortSkills([...required].filter((s) => !own.has(s) && inferredMap.has(s)));
  const missing = sortSkills([...required].filter((s) => !own.has(s) && !inferredMap.has(s)));

  const components: Partial<Record<keyof typeof WEIGHTS, number>> = {};
  if (required.size) components.skills = (matched.length + INFERRED_SKILL_CREDIT * inferred.length) / required.size;

  const similarity = cosine(tfidfVector(tokenize(`${resume.text} ${skills.join(' ')}`), idf), jobVector);
  components.text = Math.min(1, similarity / REFERENCE_COSINE);

  const years = extractYears(resume.text);
  if (job.minYears > 0) components.experience = Math.min(1, years / job.minYears);

  const education = extractEducation(resume.text);
  if (job.minEducation) {
    const min = EDUCATION_RANK[job.minEducation];
    const own = education ? EDUCATION_RANK[education] : 0;
    components.education = own >= min ? 1 : own / min;
  }

  const entries = Object.entries(components) as [keyof typeof WEIGHTS, number][];
  const totalWeight = entries.reduce((s, [c]) => s + WEIGHTS[c], 0);
  const score = round((100 * entries.reduce((s, [c, v]) => s + WEIGHTS[c] * v, 0)) / totalWeight, 1);

  return {
    name: resume.name,
    score,
    classification: classify(score),
    matched,
    inferred,
    missing,
    years,
    education,
    similarity: round(similarity, 4),
  };
}

// ---------- Synthetic resumes (load test) ----------

const SYNTHETIC_ROLES = [
  'Ingeniero de sistemas', 'Tecnólogo en desarrollo de software', 'Contador público', 'Técnico administrativo',
  'Profesional en mercadeo', 'Administrador de empresas', 'Bachiller', 'Especialista en gerencia de proyectos',
];
const SKILL_NAMES = Object.keys(SKILLS_CATALOG);

/** Small deterministic random generator, so the same count always produces the same resumes. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export function syntheticResumes(count: number, seed = 42): ResumeInput[] {
  const random = seededRandom(seed);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  return Array.from({ length: count }, (_, i) => {
    const skills = Array.from({ length: 3 + Math.floor(random() * 6) }, () => pick(SKILL_NAMES));
    const years = Math.floor(random() * 12);
    return {
      name: `Candidato sintético ${i + 1}`,
      text: `${pick(SYNTHETIC_ROLES)} con ${years} años de experiencia en ${skills.join(', ')}. Trabajo orientado a resultados.`,
    };
  });
}

// ---------- Whole batch ----------

export function analyze(job: AnalysisJob, onProgress: (fraction: number) => void = () => {}): AnalysisOutput {
  const started = performance.now();
  const resumes = [...job.resumes, ...syntheticResumes(job.syntheticCount)];
  const spec = job.job;
  const jobTokens = tokenize(`${spec.title} ${spec.description} ${spec.requirements}`);
  const idf = buildIdf([jobTokens, ...resumes.map((r) => tokenize(r.text))]);
  const jobVector = tfidfVector(jobTokens, idf);

  const results: ResumeResult[] = [];
  const step = Math.max(1, Math.floor(resumes.length / 50));
  resumes.forEach((resume, i) => {
    results.push(scoreResume(spec, resume, jobVector, idf));
    if (i % step === 0) onProgress(i / resumes.length);
  });
  onProgress(1);

  results.sort((a, b) => b.score - a.score);
  const counts: Record<Classification, number> = { high: 0, medium: 0, low: 0 };
  for (const r of results) counts[r.classification]++;
  const average = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;

  const percentiles = results.length
    ? PERCENTILES.map((pct) => {
        const count = Math.max(1, Math.ceil((results.length * pct) / 100));
        return { pct, count, minScore: results[count - 1].score };
      })
    : [];

  return {
    total: results.length,
    top: results.slice(0, TOP_LIMIT),
    percentiles,
    counts,
    averageScore: round(average, 1),
    elapsedMs: Math.round(performance.now() - started),
  };
}
