import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { ToastService } from '../services/toast.service';

/**
 * Calls `load` now and again every time another tab changes data.
 * Must be called from a constructor (it uses inject and effect).
 */
export function reloadOnRemoteChanges(load: () => void): void {
  const sync = inject(TabSyncService);
  const toasts = inject(ToastService);
  effect(() => {
    const changes = sync.remoteChanges();
    untracked(() => {
      if (changes > 0) toasts.info('Otra pestaña cambió los datos: esta vista se actualizó');
      load();
    });
  });
}

export interface WorkerMessage {
  type: 'hello' | 'tabs' | 'data-changed';
  total?: number;
  action?: string;
  time?: number;
}

/**
 * SHARED WORKER: connects this tab with public/shared-worker.js.
 * Every tab shares the same worker, so they learn about each other's changes.
 */
@Injectable({ providedIn: 'root' })
export class TabSyncService {
  readonly available = signal(false);
  readonly openTabs = signal(1);
  /** Goes up by one each time ANOTHER tab changes data: pages watch it to reload. */
  readonly remoteChanges = signal(0);
  readonly lastRemoteAction = signal<string | null>(null);

  private port: MessagePort | null = null;

  constructor() {
    this.connect();
  }

  notifyChange(action: string): void {
    this.port?.postMessage({ type: 'data-changed', action });
  }

  /** Handles a message from the worker (public so it can be tested without a real worker). */
  receive(message: WorkerMessage): void {
    if (message.type === 'hello' || message.type === 'tabs') {
      this.openTabs.set(message.total ?? 1);
    }
    if (message.type === 'data-changed') {
      this.lastRemoteAction.set(message.action ?? null);
      this.remoteChanges.update((n) => n + 1);
    }
  }

  private connect(): void {
    if (typeof SharedWorker === 'undefined') return; // browser without support

    try {
      const worker = new SharedWorker('/shared-worker.js', { name: 'ats-sync' });
      this.port = worker.port;
      this.port.onmessage = (event: MessageEvent<WorkerMessage>) => this.receive(event.data);
      this.port.start();
      this.available.set(true);

      // When the tab closes it says goodbye, so the tab counter stays right
      window.addEventListener('pagehide', () => this.port?.postMessage({ type: 'disconnect' }));
    } catch {
      this.available.set(false);
    }
  }
}
