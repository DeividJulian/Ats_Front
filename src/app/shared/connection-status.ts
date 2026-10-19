import { Component, inject } from '@angular/core';
import { CloudOff, RefreshCw } from 'lucide-angular';

import { ConnectionService } from '../core/workers/connection.service';
import { TabSyncService } from '../core/workers/tab-sync.service';
import { Icon } from './icon';

/** Offline notice (Service Worker) and open-tabs counter (Shared Worker). */
@Component({
  selector: 'app-connection-status',
  imports: [Icon],
  template: `
    @if (!connection.online()) {
      <div class="offline-pill floating" role="status">
        <app-icon [icon]="icons.off" [size]="16" /> Sin conexión: verás los últimos datos guardados
      </div>
    } @else if (connection.dataFromCache()) {
      <div class="offline-pill floating" role="status">
        <app-icon [icon]="icons.off" [size]="16" /> Mostrando datos guardados: el servidor no respondió
      </div>
    }
    @if (sync.available() && sync.openTabs() > 1) {
      <div class="tabs-pill" title="Las pestañas abiertas se avisan entre sí cuando cambian los datos">
        <app-icon [icon]="icons.sync" [size]="14" /> {{ sync.openTabs() }} pestañas sincronizadas
      </div>
    }
  `,
  styles: `
    .floating { position: fixed; left: 50%; transform: translateX(-50%); top: 14px; z-index: 90; max-width: calc(100vw - 32px); }
    .tabs-pill { position: fixed; left: 18px; bottom: 18px; z-index: 60; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--c-surface); border: 1px solid var(--c-border); box-shadow: var(--shadow-1); font-size: 12px; font-weight: 700; color: var(--c-success); }
    @media (max-width: 760px) { .tabs-pill { display: none; } }
  `,
})
export class ConnectionStatus {
  protected readonly connection = inject(ConnectionService);
  protected readonly sync = inject(TabSyncService);
  protected readonly icons = { off: CloudOff, sync: RefreshCw };
}
