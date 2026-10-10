import { HttpErrorResponse } from '@angular/common/http';

import { afterLoginUrl } from '../../pages/auth/auth-redirect';
import { pdfProblem } from '../../shared/pdf-drop';
import { LabelPipe } from '../../shared/label.pipe';
import { navFor } from '../../layout/shell';
import { errorMessage, initials, splitList } from './http-error';
import { NEXT_STATUSES, educationLabel, statusLabel } from './labels';

describe('errorMessage', () => {
  it('shows the backend message, which is already in Spanish', () => {
    const e = new HttpErrorResponse({ status: 409, error: { detail: 'Ya existe un candidato con ese correo' } });
    expect(errorMessage(e)).toBe('Ya existe un candidato con ese correo');
  });

  it('explains a connection failure', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('No se pudo conectar');
  });

  it('handles lists of details and unknown errors', () => {
    const e = new HttpErrorResponse({ status: 422, error: { detail: [{ msg: 'uno' }, { msg: 'dos' }] } });
    expect(errorMessage(e)).toBe('uno; dos');
    expect(errorMessage(new HttpErrorResponse({ status: 500 }))).toBe('Error 500');
    expect(errorMessage(new Error('falló'))).toBe('falló');
    expect(errorMessage('raro')).toBe('Ocurrió un error inesperado');
  });
});

describe('small helpers', () => {
  it('splits lists and builds initials', () => {
    expect(splitList('Python, SQL;\nExcel, ')).toEqual(['Python', 'SQL', 'Excel']);
    expect(initials('camila ortega ruiz')).toBe('CO');
    expect(initials('')).toBe('?');
  });

  it('labels every API code in Spanish', () => {
    const pipe = new LabelPipe();
    expect(pipe.transform('shortlisted', 'status')).toBe('Preseleccionado');
    expect(pipe.transform('open', 'jobStatus')).toBe('Abierta');
    expect(pipe.transform('high', 'classification')).toBe('Alto');
    expect(pipe.transform('recruiter', 'role')).toBe('Reclutador');
    expect(pipe.transform('interview_with_reservations', 'recommendation')).toBe('Entrevistar con reservas');
    expect(pipe.transform('skills', 'breakdown')).toBe('Habilidades');
    expect(educationLabel('masters')).toBe('Maestría');
    expect(educationLabel(null)).toBe('No indicado');
    expect(statusLabel('desconocido')).toBe('desconocido');
  });

  it('follows the same pipeline as the backend', () => {
    expect(NEXT_STATUSES.new).toEqual(['shortlisted', 'rejected']);
    expect(NEXT_STATUSES.hired).toEqual([]);
    expect(NEXT_STATUSES.rejected).toEqual([]);
  });

  it('accepts only PDFs up to 5 MB', () => {
    expect(pdfProblem(new File(['x'], 'cv.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(pdfProblem(new File(['x'], 'cv.docx', { type: 'application/msword' }))).toContain('PDF');
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cv.pdf', { type: 'application/pdf' });
    expect(pdfProblem(big)).toContain('5 MB');
  });
});

describe('navigation by role', () => {
  it('shows each role its own menu', () => {
    expect(navFor('candidate').map((i) => i.path)).toEqual(['/portal', '/portal/vacantes', '/portal/postulaciones', '/portal/perfil']);
    expect(navFor('recruiter').some((i) => i.path === '/app/usuarios')).toBe(false);
    expect(navFor('admin').some((i) => i.path === '/app/usuarios')).toBe(true);
  });

  it('returns to the requested page only when it is ours and fits the role', () => {
    expect(afterLoginUrl('/empleos/3', 'candidate')).toBe('/empleos/3');
    expect(afterLoginUrl('/app/vacantes', 'recruiter')).toBe('/app/vacantes');
    expect(afterLoginUrl('/app/vacantes', 'candidate')).toBe('/portal');
    expect(afterLoginUrl('/portal', 'admin')).toBe('/app');
    expect(afterLoginUrl('https://malicioso.com', 'admin')).toBe('/app');
    expect(afterLoginUrl('//malicioso.com', 'candidate')).toBe('/portal');
    expect(afterLoginUrl(undefined, 'candidate')).toBe('/portal');
  });
});
