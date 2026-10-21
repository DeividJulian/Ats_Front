import { TestBed } from '@angular/core/testing';

import { PdfDrop } from './pdf-drop';

describe('PdfDrop', () => {
  it('shows why the server rejected the file', async () => {
    const fixture = TestBed.createComponent(PdfDrop);
    fixture.componentRef.setInput('serverError', 'La hoja de vida es de «Carlos Ortega», pero el perfil es de «Deivid». Sube tu propia hoja de vida.');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('[role=alert]')?.textContent).toContain('Carlos Ortega');
    expect(page.querySelector('.dropzone')?.classList).toContain('is-error');
  });

  it('rejects a file that is not a PDF before sending it', async () => {
    const fixture = TestBed.createComponent(PdfDrop);
    const sent: File[] = [];
    fixture.componentInstance.fileSelected.subscribe((f) => sent.push(f));
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'cv.docx', { type: 'application/msword' })] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(sent).toHaveLength(0);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('debe ser un PDF');
  });
});
