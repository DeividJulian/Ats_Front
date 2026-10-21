import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}

/** More than this covers the screen on a phone: the oldest ones go away. */
export const MAX_TOASTS = 4;

/** Short notifications in the corner of the screen. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  ok(text: string): void {
    this.push('ok', text, 3500);
  }

  info(text: string): void {
    this.push('info', text, 4500);
  }

  error(text: string): void {
    this.push('error', text, 7000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], text: string, ms: number): void {
    // The same message twice in a row (a button pressed again) is shown once
    if (this.toasts().some((t) => t.kind === kind && t.text === text)) return;
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, text }].slice(-MAX_TOASTS));
    setTimeout(() => this.dismiss(id), ms);
  }
}
