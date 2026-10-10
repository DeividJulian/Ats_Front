import { Component, HostListener, input, output } from '@angular/core';

/** Dialog over the page. Closes with the × button, the Escape key or a click outside. */
@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>{{ title() }}</h2>
          <button type="button" class="btn small ghost" aria-label="Cerrar" (click)="closed.emit()">✕</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
