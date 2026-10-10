import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConnectionService } from './core/workers/connection.service';
import { TabSyncService } from './core/workers/tab-sync.service';
import { ConnectionStatus } from './shared/connection-status';
import { Toasts } from './shared/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConnectionStatus, Toasts],
  template: `
    <router-outlet />
    <app-connection-status />
    <app-toasts />
  `,
})
export class App {
  // Injecting them here registers the Service Worker and connects to the Shared Worker when the app opens
  constructor() {
    inject(ConnectionService);
    inject(TabSyncService);
  }
}
