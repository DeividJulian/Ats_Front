import { AiEvaluation, Application, RankingItem } from '../../../core/models';
import { rankingToCsv } from './ranking';

const ITEM: RankingItem = {
  position: 1, application_id: 10, candidate_id: 3, name: 'Diego Paredes', email: 'diego@mail.com',
  score: 92.9, classification: 'high', status: 'interview', matching_skills: [], missing_skills: [],
};
const DETAILS = { 10: { details: { breakdown: { skills: 85.7, experience: 100, text: 55 } } } as unknown as Application };
const EVALUATION = { 10: { recommendation: 'advance' } as AiEvaluation };

describe('rankingToCsv', () => {
  it('exports every column with Spanish labels', () => {
    const [header, row] = rankingToCsv([ITEM], DETAILS, EVALUATION, false).split('\r\n');
    expect(header).toBe('"Posición";"Candidato";"Correo";"Puntaje";"Habilidades";"Experiencia";"Educación";"Similitud";"Estado";"IA asesora"');
    expect(row).toBe('"1";"Diego Paredes";"diego@mail.com";"92.9";"85.7";"100";"";"55";"Entrevista";"Avanzar en el proceso"');
  });

  it('never exports names or emails in anonymous mode', () => {
    const csv = rankingToCsv([ITEM], DETAILS, {}, true);
    expect(csv).not.toContain('Diego');
    expect(csv).not.toContain('diego@mail.com');
    expect(csv).toContain('"Candidato 1"');
    expect(csv).toContain('"Sin evaluar"');
  });
});
