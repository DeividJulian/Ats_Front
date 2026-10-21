import { TestBed } from '@angular/core/testing';

import { MAX_TOASTS, ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the same message only once', () => {
    const toasts = TestBed.inject(ToastService);
    toasts.error('No pudimos enviar el correo');
    toasts.error('No pudimos enviar el correo');
    expect(toasts.toasts()).toHaveLength(1);
  });

  it('keeps only the newest ones', () => {
    const toasts = TestBed.inject(ToastService);
    for (let i = 1; i <= MAX_TOASTS + 2; i++) toasts.info(`Aviso ${i}`);
    expect(toasts.toasts().map((t) => t.text)).toEqual(['Aviso 3', 'Aviso 4', 'Aviso 5', 'Aviso 6']);
  });

  it('errors stay longer than confirmations', () => {
    const toasts = TestBed.inject(ToastService);
    toasts.ok('Guardado');
    toasts.error('Falló');
    vi.advanceTimersByTime(4000);
    expect(toasts.toasts().map((t) => t.text)).toEqual(['Falló']);
    vi.advanceTimersByTime(3500);
    expect(toasts.toasts()).toEqual([]);
  });
});
