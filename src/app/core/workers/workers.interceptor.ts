import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { API_URL } from '../config/api.config';
import { ConnectionService } from './connection.service';
import { TabSyncService } from './tab-sync.service';

const CHANGES_DATA = /^\/(jobs|candidates|applications|seed|me|users)(\/|\?|$)/;

/**
 * - When a request changes data (POST/PUT/PATCH/DELETE), tells the other tabs through the Shared Worker.
 * - When the Service Worker answered with saved data, tells the interface.
 */
export const workersInterceptor: HttpInterceptorFn = (request, next) => {
  const sync = inject(TabSyncService);
  const connection = inject(ConnectionService);

  const isApi = request.url.startsWith(API_URL);
  const path = request.url.slice(API_URL.length);
  const changesData = isApi && request.method !== 'GET' && CHANGES_DATA.test(path);

  return next(request).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse) || !isApi) return;

      if (changesData && event.ok) {
        sync.notifyChange(`${request.method} ${path}`);
      }
      if (request.method === 'GET') {
        connection.markDataFromCache(event.headers.get('X-From-Cache') === '1');
      }
    }),
  );
};
