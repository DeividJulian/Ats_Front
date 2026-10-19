import { Component, inject } from '@angular/core';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-angular';

import { ToastService } from '../core/services/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.toast--success]="toast.kind === 'ok'" [class.toast--error]="toast.kind === 'error'" [class.toast--info]="toast.kind === 'info'" role="status">
          <app-icon class="toast__icon" [icon]="toast.kind === 'ok' ? icons.ok : toast.kind === 'error' ? icons.error : icons.info" [size]="20" />
          <span class="toast__text-main">{{ toast.text }}</span>
          <button type="button" class="toast__close" aria-label="Cerrar" (click)="toasts.dismiss(toast.id)">
            <app-icon [icon]="icons.x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast { animation: enter .2s ease-out; }
    .toast__text-main { flex: 1; min-width: 0; padding-top: 1px; }
    @keyframes enter { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
  protected readonly icons = { ok: CircleCheck, error: CircleAlert, info: Info, x: X };
}
