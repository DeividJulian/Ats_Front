import { JOBS_VIEW_KEY, savedJobsView } from './jobs';

describe('jobs view preference', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the cards and remembers the table', () => {
    expect(savedJobsView()).toBe('cards');
    localStorage.setItem(JOBS_VIEW_KEY, 'table');
    expect(savedJobsView()).toBe('table');
    localStorage.setItem(JOBS_VIEW_KEY, 'otra cosa');
    expect(savedJobsView()).toBe('cards');
  });

  it('falls back to the cards when storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(savedJobsView()).toBe('cards');
    get.mockRestore();
  });
});
