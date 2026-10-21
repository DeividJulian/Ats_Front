import { API_CACHE, clearApiCache } from './api-cache';

describe('Service Worker caches', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the app and the Service Worker use the same name for the API cache', async () => {
    const response = await fetch('/sw.js').catch(() => null);
    const source = response?.ok ? await response.text() : null;
    if (source) {
      const version = /const VERSION = '([^']+)'/.exec(source)![1];
      expect(API_CACHE).toBe(`ats-api-${version}`);
    }
    expect(API_CACHE).toMatch(/^ats-api-v\d+$/);
  });

  it('logging out deletes exactly that cache', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('caches', { delete: async (name: string) => (deleted.push(name), true) });
    await clearApiCache();
    expect(deleted).toEqual([API_CACHE]);
  });
});
