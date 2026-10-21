import { CanDeactivateFn } from '@angular/router';

/** Screens with a form that can be left half-filled. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

export const LEAVE_MESSAGE = 'Tienes cambios sin guardar. ¿Salir de todos modos?';

/** Asks before leaving a form with changes that were not saved. */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component?.hasUnsavedChanges() || confirm(LEAVE_MESSAGE);
