import { Injectable, isDevMode, signal } from '@angular/core';

/**
 * SERVICE WORKER: registers public/sw.js and exposes the connection state.
 * It is not registered during development (ng serve) to avoid confusion with cached files.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  /** true when the last backend answer came from the copy saved by the Service Worker. */
  readonly dataFromCache = signal(false);
  readonly serviceWorkerActive = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    this.registerServiceWorker();
  }

  markDataFromCache(fromCache: boolean): void {
    this.dataFromCache.set(fromCache);
  }

  private registerServiceWorker(): void {
    if (isDevMode() || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then(() => this.serviceWorkerActive.set(true))
      .catch(() => this.serviceWorkerActive.set(false));
  }
}
