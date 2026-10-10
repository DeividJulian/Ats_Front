import { Component, input, output, signal } from '@angular/core';
import { CloudUpload } from 'lucide-angular';

import { Icon } from './icon';

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Returns why a file can't be uploaded, or null if it is a valid PDF. */
export function pdfProblem(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'El archivo debe ser un PDF';
  if (file.size > MAX_PDF_BYTES) return 'El archivo supera el máximo de 5 MB';
  return null;
}

/** Area to drop or choose a PDF resume. */
@Component({
  selector: 'app-pdf-drop',
  imports: [Icon],
  template: `
    <label
      class="drop"
      [class.over]="over()"
      [class.busy]="busy()"
      (dragover)="$event.preventDefault(); over.set(true)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <input type="file" accept="application/pdf,.pdf" [disabled]="busy()" (change)="onChoose($event)" />
      @if (busy()) {
        <span class="spinner"></span>
        <span>Leyendo la hoja de vida…</span>
      } @else {
        <span class="icon-tile"><app-icon [icon]="uploadIcon" [size]="22" /></span>
        <strong>{{ text() }}</strong>
        <span class="hint">Arrastra el PDF aquí o haz clic para elegirlo (máximo 5 MB)</span>
      }
      @if (problem()) {
        <span class="error-text">{{ problem() }}</span>
      }
    </label>
  `,
  styles: `
    .drop { position: relative; display: grid; justify-items: center; gap: 6px; padding: 24px 18px; text-align: center; border: 2px dashed #cdd5e5; border-radius: var(--radius); background: var(--surface-2); cursor: pointer; color: var(--text); transition: border-color 0.15s ease, background 0.15s ease; }
    .drop:hover, .drop.over { border-color: var(--accent); background: #fff8ef; }
    .drop.busy { cursor: progress; }
    input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  `,
})
export class PdfDrop {
  readonly text = input('Sube la hoja de vida en PDF');
  readonly busy = input(false);
  readonly fileSelected = output<File>();

  protected readonly uploadIcon = CloudUpload;

  protected readonly over = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected onChoose(event: Event): void {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    field.value = '';
    if (file) this.accept(file);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.accept(file);
  }

  private accept(file: File): void {
    const problem = pdfProblem(file);
    this.problem.set(problem);
    if (!problem) this.fileSelected.emit(file);
  }
}
