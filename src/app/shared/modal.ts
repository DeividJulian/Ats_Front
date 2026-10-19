import { Component, HostListener, input, output } from '@angular/core';
import { X } from 'lucide-angular';

import { Icon } from './icon';

/** Dialog over the page. Closes with the × button, the Escape key or a click outside. */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  template: `
    <div class="overlay" (click)="closed.emit()">
      <div class="modal modal--app" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <div class="modal__head">
          <h2 class="modal__title">{{ title() }}</h2>
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" aria-label="Cerrar" (click)="closed.emit()">
            <app-icon [icon]="x" />
          </button>
        </div>
        <div class="modal__content"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .modal--app { max-width: 760px; max-height: 90vh; overflow-y: auto; }
    .modal__head { align-items: center; padding: 18px 18px 0 22px; }
    .modal__content { padding: 16px 22px 22px; display: grid; gap: 16px; }
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  protected readonly x = X;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
