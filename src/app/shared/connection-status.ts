import { Component, inject } from '@angular/core';

import { ConnectionService } from '../core/workers/connection.service';
import { TabSyncService } from '../core/workers/tab-sync.service';

/** Offline banner (Service Worker) and open-tabs counter (Shared Worker). */
@Component({
  selector: 'app-connection-status',
  template: `
    @if (!connection.online()) {
      <div class="banner offline" role="status">
        Sin conexión: verás los últimos datos guardados. Los cambios se podrán hacer al volver la conexión.
      </div>
    } @else if (connection.dataFromCache()) {
      <div class="banner cached" role="status">Mostrando datos guardados: el servidor no respondió.</div>
    }
    @if (sync.available() && sync.openTabs() > 1) {
      <div class="tabs-pill" title="Las pestañas abiertas se avisan entre sí cuando cambian los datos">
        <span class="dot"></span> {{ sync.openTabs() }} pestañas sincronizadas
      </div>
    }
  `,
  styles: `
    .banner { position: fixed; left: 50%; transform: translateX(-50%); bottom: 18px; z-index: 90; padding: 10px 16px; border-radius: 14px; font-size: 14px; font-weight: 600; box-shadow: var(--shadow-lg); max-width: calc(100vw - 36px); }
    .offline { background: var(--warn-soft); color: #92400e; }
    .cached { background: var(--info-soft); color: #1e3a8a; }
    .tabs-pill { position: fixed; left: 18px; bottom: 18px; z-index: 60; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow); font-size: 12px; font-weight: 600; color: var(--muted); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); box-shadow: 0 0 0 3px var(--good-soft); }
    @media (max-width: 900px) { .banner { bottom: 86px; } .tabs-pill { bottom: 86px; left: 12px; } }
  `,
})
export class ConnectionStatus {
  protected readonly connection = inject(ConnectionService);
  protected readonly sync = inject(TabSyncService);
}
