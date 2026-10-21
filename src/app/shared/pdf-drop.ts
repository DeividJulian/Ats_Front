import { Component, input, output, signal } from '@angular/core';
import { CircleAlert, CloudUpload } from 'lucide-angular';

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
      class="dropzone"
      [class.is-over]="over()"
      [class.is-error]="!!problem() || !!serverError()"
      [class.busy]="busy()"
      (dragover)="$event.preventDefault(); over.set(true)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <input type="file" accept="application/pdf,.pdf" [disabled]="busy()" (change)="onChoose($event)" [attr.aria-label]="text()" />
      @if (busy()) {
        <span class="spinner spinner--lg t-primary"></span>
        <span class="t-strong">Leyendo la hoja de vida…</span>
        <span class="t-small t-muted">Detectamos habilidades, experiencia y educación</span>
      } @else {
        <span class="dropzone__icon"><app-icon [icon]="i.CloudUpload" [size]="24" /></span>
        <span class="t-strong">{{ text() }}</span>
        <span class="t-small t-muted">Arrástralo aquí o <span class="t-primary t-strong">elige un archivo</span> · PDF de máximo 5 MB</span>
      }
    </label>
    @if (problem() || serverError()) {
      <span class="field__error" role="alert"><app-icon [icon]="i.CircleAlert" [size]="15" />{{ problem() || serverError() }}</span>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 8px; }
    .dropzone { position: relative; }
    .dropzone.busy { cursor: progress; }
    input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
  `,
})
export class PdfDrop {
  readonly text = input('Sube la hoja de vida en PDF');
  readonly busy = input(false);
  /** Why the server rejected the last file (for example, a resume that belongs to someone else). */
  readonly serverError = input<string | null>(null);
  readonly fileSelected = output<File>();

  protected readonly i = { CircleAlert, CloudUpload };

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
