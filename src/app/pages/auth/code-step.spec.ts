import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_URL } from '../../core/config/api.config';
import { USER, fakeToken } from '../../../testing/fixtures';
import { CodeStep, inboxFor } from './code-step';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const fixture = TestBed.createComponent(CodeStep);
  fixture.componentRef.setInput('email', 'laura@empresa.com');
  return { fixture, backend: TestBed.inject(HttpTestingController), page: fixture.nativeElement as HTMLElement };
}

function type(page: HTMLElement, value: string) {
  const input = page.querySelector<HTMLInputElement>('input#code')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('CodeStep', () => {
  beforeEach(() => localStorage.clear());

  it('sends the code by itself once the six digits are pasted', async () => {
    const { fixture, backend, page } = setup();
    await fixture.whenStable();
    type(page, 'Tu código: 123 456');
    const req = backend.expectOne(`${API_URL}/auth/verify`);
    expect(req.request.body).toEqual({ email: 'laura@empresa.com', code: '123456' });
    req.flush({ access_token: fakeToken(Math.floor(Date.now() / 1000) + 3600), token_type: 'bearer', user: USER });
  });

  it('waits while the code is incomplete', async () => {
    const { fixture, backend, page } = setup();
    await fixture.whenStable();
    type(page, '1234');
    backend.expectNone(`${API_URL}/auth/verify`);
  });

  it('counts down before allowing to resend', async () => {
    vi.useFakeTimers();
    const { fixture, page } = setup();
    fixture.detectChanges();
    expect(page.textContent).toContain('Reenviar en 30 s');
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(page.textContent).toContain('Reenviar código');
    vi.useRealTimers();
  });
});

describe('inboxFor', () => {
  it('opens the inbox of the usual providers', () => {
    expect(inboxFor('deivid+camila@gmail.com')?.label).toBe('Abrir Gmail');
    expect(inboxFor('ana@Hotmail.com')?.label).toBe('Abrir Outlook');
    expect(inboxFor('luis@yahoo.es')?.label).toBe('Abrir Yahoo Mail');
    expect(inboxFor('laura@empresa.com')).toBeNull();
  });
});
