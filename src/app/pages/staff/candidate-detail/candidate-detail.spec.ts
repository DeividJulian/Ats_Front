import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_URL } from '../../../core/config/api.config';
import { Candidate } from '../../../core/models';
import { CandidateDetail } from './candidate-detail';

const CANDIDATE: Candidate = {
  id: 4, name: 'Andrés Molina', email: 'andres@mail.com', phone: '3001112233', resume_text: '', skills: ['excel'],
  experience_years: 5, education_level: 'professional', created_at: '2026-10-10T00:00:00Z',
};

describe('Candidate detail', () => {
  it('links the email to the mail app and copies it', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CandidateDetail);
    fixture.componentRef.setInput('id', '4');
    fixture.detectChanges();
    backend.expectOne(`${API_URL}/candidates/4`).flush(CANDIDATE);
    backend.match(() => true).forEach((r) => r.flush(r.request.url.includes('insights') ? null : []));
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLAnchorElement>('a[href^="mailto:"]')!.getAttribute('href')).toBe('mailto:andres@mail.com');

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    page.querySelector<HTMLButtonElement>('button[aria-label="Copiar correo"]')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('andres@mail.com');
    vi.unstubAllGlobals();
  });
});
