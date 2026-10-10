import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_URL } from '../config/api.config';
import { ConnectionService } from './connection.service';
import { TabSyncService } from './tab-sync.service';
import { workersInterceptor } from './workers.interceptor';

describe('TabSyncService (Shared Worker)', () => {
  it('tracks open tabs and changes made in other tabs', () => {
    const sync = TestBed.inject(TabSyncService);
    sync.receive({ type: 'hello', total: 3 });
    expect(sync.openTabs()).toBe(3);
    sync.receive({ type: 'data-changed', action: 'POST /jobs' });
    sync.receive({ type: 'data-changed', action: 'DELETE /candidates/2' });
    expect(sync.remoteChanges()).toBe(2);
    expect(sync.lastRemoteAction()).toBe('DELETE /candidates/2');
    sync.receive({ type: 'tabs', total: 1 });
    expect(sync.openTabs()).toBe(1);
  });
});

describe('workersInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let sync: TabSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([workersInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    sync = TestBed.inject(TabSyncService);
  });

  it('tells the other tabs when data changes', () => {
    const notify = vi.spyOn(sync, 'notifyChange');
    http.post(`${API_URL}/jobs`, {}).subscribe();
    backend.expectOne(`${API_URL}/jobs`).flush({ id: 1 });
    expect(notify).toHaveBeenCalledWith('POST /jobs');
  });

  it('does not notify for reads, failed writes or non-data endpoints', () => {
    const notify = vi.spyOn(sync, 'notifyChange');
    http.get(`${API_URL}/jobs`).subscribe();
    backend.expectOne(`${API_URL}/jobs`).flush([]);
    http.post(`${API_URL}/candidates`, {}).subscribe({ error: () => undefined });
    backend.expectOne(`${API_URL}/candidates`).flush({ detail: 'x' }, { status: 409, statusText: 'Conflict' });
    http.post(`${API_URL}/nlp/analyze-text`, {}).subscribe();
    backend.expectOne(`${API_URL}/nlp/analyze-text`).flush({});
    expect(notify).not.toHaveBeenCalled();
  });

  it('reports when the Service Worker answered with saved data', () => {
    const connection = TestBed.inject(ConnectionService);
    http.get(`${API_URL}/stats`).subscribe();
    backend.expectOne(`${API_URL}/stats`).flush({}, { headers: { 'X-From-Cache': '1' } });
    expect(connection.dataFromCache()).toBe(true);
    http.get(`${API_URL}/stats`).subscribe();
    backend.expectOne(`${API_URL}/stats`).flush({});
    expect(connection.dataFromCache()).toBe(false);
  });
});
