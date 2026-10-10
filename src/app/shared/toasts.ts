import { Component, inject } from '@angular/core';

import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="toast.kind" role="status">
          <span class="icon">{{ toast.kind === 'ok' ? '✓' : toast.kind === 'error' ? '!' : 'i' }}</span>
          <span class="text">{{ toast.text }}</span>
          <button type="button" aria-label="Cerrar" (click)="toasts.dismiss(toast.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 18px; bottom: 18px; z-index: 100; display: grid; gap: 10px; width: min(380px, calc(100vw - 36px)); }
    .toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border); box-shadow: var(--shadow); animation: enter 0.2s ease-out; }
    .toast.ok { border-color: rgba(52, 211, 153, 0.6); }
    .toast.error { border-color: rgba(248, 113, 113, 0.6); }
    .icon { width: 22px; height: 22px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; background: var(--surface-3); }
    .ok .icon { color: var(--good); }
    .error .icon { color: var(--bad); }
    .info .icon { color: var(--info); }
    .text { flex: 1; font-size: 14px; }
    button { background: none; border: none; color: var(--muted); font-size: 18px; line-height: 1; cursor: pointer; }
    @keyframes enter { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
