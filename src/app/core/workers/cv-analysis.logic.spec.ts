import {
  AnalysisJobSpec,
  analyze,
  buildIdf,
  canonicalizeSkills,
  classify,
  cosine,
  extractEducation,
  extractSkills,
  extractYears,
  inferSkills,
  normalize,
  scoreResume,
  syntheticResumes,
  tfidfVector,
  tokenize,
} from './cv-analysis.logic';

// These cases mirror the backend tests (tests/test_nlp.py, tests/test_ai.py): both sides must agree.
describe('text processing (same as the backend)', () => {
  it('normalizes accents and case', () => {
    expect(normalize('Ingeniería de Sistemas')).toBe('ingenieria de sistemas');
  });

  it('tokenizes without stopwords and merges plurals', () => {
    expect(tokenize('Los clientes de la empresa')).toEqual(['cliente', 'empresa']);
  });

  it('does not confuse java with javascript, nor sql with postgresql', () => {
    expect(extractSkills('Programo en JavaScript')).toEqual(['javascript']);
    expect(extractSkills('Programo en Java y JavaScript')).toContain('java');
    expect(extractSkills('Uso PostgreSQL')).toEqual(['postgresql']);
  });

  it('merges synonyms and keeps Spanish accents in skill names', () => {
    expect(canonicalizeSkills(['Postgres', ' EXCEL ', 'Inglés'])).toEqual(['excel', 'inglés', 'postgresql']);
    expect(extractSkills('Manejo de nomina, facturacion y analisis de datos')).toEqual([
      'análisis de datos',
      'facturación',
      'nómina',
    ]);
  });

  it('infers related skills, also through chains', () => {
    expect(Object.fromEntries(inferSkills(['angular', 'postgresql']))).toEqual({
      typescript: 'angular',
      javascript: 'angular',
      sql: 'postgresql',
    });
  });

  it('extracts years of experience and the highest education level', () => {
    expect(extractYears('Tengo 25 años. Cuento con 5 años de experiencia en ventas')).toBe(5);
    expect(extractYears('Experiencia laboral de 3 años como contador')).toBe(3);
    expect(extractYears('Sin datos')).toBe(0);
    expect(extractEducation('Técnico en sistemas y Maestría en gestión')).toBe('masters');
    expect(extractEducation('Ingeniero de sistemas')).toBe('professional');
    expect(extractEducation('Me gusta correr')).toBeNull();
  });

  it('measures text similarity with TF-IDF', () => {
    const docs = ['desarrollador python fastapi', 'programador python con fastapi', 'vendedor de mostrador'].map(tokenize);
    const idf = buildIdf(docs);
    const [a, b, c] = docs.map((d) => tfidfVector(d, idf));
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
    expect(cosine(a, a)).toBeCloseTo(1, 6);
    expect(cosine(tfidfVector([], idf), a)).toBe(0);
  });
});

describe('scoring', () => {
  const job: AnalysisJobSpec = {
    title: 'Desarrollador Python',
    description: 'APIs REST con Python y FastAPI',
    requirements: 'Python, SQL, Docker',
    requiredSkills: ['python', 'sql', 'docker'],
    minYears: 2,
    minEducation: 'technologist',
  };

  function score(text: string) {
    const docs = [tokenize(`${job.title} ${job.description} ${job.requirements}`), tokenize(text)];
    const idf = buildIdf(docs);
    return scoreResume(job, { name: 'X', text }, tfidfVector(docs[0], idf), idf);
  }

  it('classifies like the backend', () => {
    expect(classify(75)).toBe('high');
    expect(classify(74.9)).toBe('medium');
    expect(classify(50)).toBe('medium');
    expect(classify(49.9)).toBe('low');
  });

  it('rewards an ideal resume and penalizes an unrelated one', () => {
    const ideal = score('Ingeniero con 4 años de experiencia en Python, SQL, Docker y FastAPI');
    const unrelated = score('Bachiller con experiencia en ventas de mostrador');
    expect(ideal.classification).toBe('high');
    expect(ideal.missing).toEqual([]);
    expect(unrelated.classification).toBe('low');
    expect(unrelated.missing).toEqual(['docker', 'python', 'sql']);
  });

  it('counts inferred skills apart from the proven ones', () => {
    const r = score('Tecnólogo con 3 años de experiencia en Python, PostgreSQL y Docker');
    expect(r.matched).toEqual(['docker', 'python']);
    expect(r.inferred).toEqual(['sql']);
    expect(r.missing).toEqual([]);
  });
});

describe('bulk analysis', () => {
  const job = {
    title: 'Auxiliar contable',
    description: 'Registro de facturas y conciliaciones',
    requirements: 'Contabilidad, Excel, Siigo',
    requiredSkills: ['contabilidad', 'excel', 'siigo'],
    minYears: 2,
    minEducation: null,
  };

  it('generates the same synthetic resumes every time', () => {
    expect(syntheticResumes(3)).toEqual(syntheticResumes(3));
    expect(syntheticResumes(5)).toHaveLength(5);
  });

  it('sorts by score, counts classes and reports progress', () => {
    const progress: number[] = [];
    const output = analyze(
      {
        job,
        resumes: [
          { name: 'Ana', text: 'Contadora con 5 años de experiencia en contabilidad, Excel y Siigo' },
          { name: 'Luis', text: 'Desarrollador de software' },
        ],
        syntheticCount: 200,
      },
      (p) => progress.push(p),
    );
    expect(output.total).toBe(202);
    expect(output.top[0].name).toBe('Ana');
    expect(output.top.length).toBeLessThanOrEqual(200);
    expect(output.percentiles.map((g) => [g.pct, g.count])).toEqual([[1, 3], [5, 11], [10, 21]]);
    expect(output.percentiles[0].minScore).toBeGreaterThanOrEqual(output.percentiles[2].minScore);
    const scores = output.top.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(output.counts.high + output.counts.medium + output.counts.low).toBe(202);
    expect(progress.at(-1)).toBe(1);
  });
});
