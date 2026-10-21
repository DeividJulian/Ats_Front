import { Candidate } from '../../../core/models';
import { sortCandidates } from './candidates';

const make = (id: number, name: string, years: number, skills: number, created: string): Candidate => ({
  id, name, email: `${id}@mail.com`, phone: null, resume_text: '', skills: Array.from({ length: skills }, (_, i) => `s${i}`),
  experience_years: years, education_level: null, created_at: created,
});

const LIST = [
  make(1, 'Óscar Ruiz', 2, 5, '2026-10-01T00:00:00Z'),
  make(2, 'ana Pérez', 8, 1, '2026-10-03T00:00:00Z'),
  make(3, 'Bruno Díaz', 8, 3, '2026-10-02T00:00:00Z'),
];

describe('sortCandidates', () => {
  it('orders by the chosen criterion', () => {
    expect(sortCandidates(LIST, 'recent').map((c) => c.id)).toEqual([2, 3, 1]);
    expect(sortCandidates(LIST, 'name').map((c) => c.id)).toEqual([2, 3, 1]);
    expect(sortCandidates(LIST, 'skills').map((c) => c.id)).toEqual([1, 3, 2]);
  });

  it('breaks ties with the most recent first and does not change the original list', () => {
    expect(sortCandidates(LIST, 'experience').map((c) => c.id)).toEqual([2, 3, 1]);
    expect(LIST.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});
