import { csvCell, csvFileName, toCsv } from './csv';

describe('csv helpers', () => {
  it('quotes every cell and doubles the inner quotes', () => {
    expect(csvCell('Pérez, "Pepe"')).toBe('"Pérez, ""Pepe"""');
    expect(csvCell(92.9)).toBe('"92.9"');
    expect(csvCell(null)).toBe('""');
  });

  it('separates columns with ; and rows with Windows line breaks', () => {
    expect(toCsv(['A', 'B'], [[1, 'x'], [2, 'y']])).toBe('"A";"B"\r\n"1";"x"\r\n"2";"y"');
  });

  it('builds safe file names', () => {
    expect(csvFileName('ranking', 'Desarrollador Backend / Python')).toBe('ranking-desarrollador-backend-python.csv');
    expect(csvFileName()).toBe('datos.csv');
  });
});
