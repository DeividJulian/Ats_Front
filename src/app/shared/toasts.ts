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
    .toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow-lg); animation: enter 0.2s ease-out; }
    .icon { width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; }
    .ok .icon { color: var(--good); background: var(--good-soft); }
    .error .icon { color: var(--bad); background: var(--bad-soft); }
    .info .icon { color: var(--info); background: var(--info-soft); }
    @media (max-width: 900px) { .toasts { bottom: 86px; right: 12px; width: calc(100vw - 24px); } }
    .text { flex: 1; font-size: 14px; }
    button { background: none; border: none; color: var(--muted); font-size: 18px; line-height: 1; cursor: pointer; }
    @keyframes enter { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class Toasts {
  protected readonly toasts = inject(ToastService);
}
