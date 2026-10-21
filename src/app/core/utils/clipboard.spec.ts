import { copyText, publicJobUrl } from './clipboard';

describe('clipboard helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds the public link of a job', () => {
    expect(publicJobUrl(12, 'https://ats-front-six.vercel.app')).toBe('https://ats-front-six.vercel.app/empleos/12');
  });

  it('copies when the browser allows it and says so when it does not', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('hola')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hola');

    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await copyText('hola')).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(await copyText('hola')).toBe(false);
  });
});
