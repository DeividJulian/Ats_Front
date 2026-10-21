import { USER } from '../../../../testing/fixtures';
import { accountState } from './users';

describe('accountState', () => {
  it('tells active, unverified and deactivated accounts apart', () => {
    expect(accountState(USER)).toBe('active');
    expect(accountState({ ...USER, verified: false })).toBe('unverified');
    // Deactivated wins: it can't be used whatever its verification
    expect(accountState({ ...USER, verified: false, is_active: false })).toBe('inactive');
  });
});

describe('Users page', () => {
  it('sends the access code to an account that has not entered yet', async () => {
    const { provideHttpClient } = await import('@angular/common/http');
    const { HttpTestingController, provideHttpClientTesting } = await import('@angular/common/http/testing');
    const { TestBed } = await import('@angular/core/testing');
    const { provideRouter } = await import('@angular/router');
    const { API_URL } = await import('../../../core/config/api.config');
    const { Users } = await import('./users');

    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Users);
    fixture.detectChanges();
    backend.expectOne(`${API_URL}/users`).flush([{ ...USER, id: 9, email: 'nuevo@empresa.com', verified: false }]);
    backend.match(() => true).forEach((r) => r.flush({ configured: false, provider: 'groq', model: '' }));
    await fixture.whenStable();

    const page = fixture.nativeElement as HTMLElement;
    [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Enviar código'))!.click();
    const req = backend.expectOne(`${API_URL}/auth/login`);
    expect(req.request.body).toEqual({ email: 'nuevo@empresa.com' });
  });
});
