import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { routes } from '../../app.routes';
import { HasUnsavedChanges, LEAVE_MESSAGE, unsavedChangesGuard } from './unsaved-changes.guard';

function leave(dirty: boolean): boolean {
  const screen: HasUnsavedChanges = { hasUnsavedChanges: () => dirty };
  return TestBed.runInInjectionContext(
    () => unsavedChangesGuard(screen, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot) as boolean,
  );
}

describe('unsavedChangesGuard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets you leave a form without changes, without asking', () => {
    const ask = vi.spyOn(window, 'confirm');
    expect(leave(false)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks before losing changes and respects the answer', () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(leave(true)).toBe(false);
    expect(leave(true)).toBe(true);
    expect(ask).toHaveBeenCalledWith(LEAVE_MESSAGE);
  });

  it('protects the job form when creating and editing', () => {
    const app = routes.find((r) => r.path === 'app')!;
    for (const path of ['vacantes/nueva', 'vacantes/:id/editar']) {
      expect(app.children!.find((r) => r.path === path)!.canDeactivate).toContain(unsavedChangesGuard);
    }
  });

  it('protects the candidate registration and the candidate profile', () => {
    const app = routes.find((r) => r.path === 'app')!;
    const portal = routes.find((r) => r.path === 'portal')!;
    expect(app.children!.find((r) => r.path === 'candidatos/nuevo')!.canDeactivate).toContain(unsavedChangesGuard);
    expect(portal.children!.find((r) => r.path === 'perfil')!.canDeactivate).toContain(unsavedChangesGuard);
  });
});
