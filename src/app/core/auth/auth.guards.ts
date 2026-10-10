import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../models';
import { AuthService, homeFor } from './auth.service';

/** Only with a session; otherwise to the login, remembering where the user wanted to go. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

/** Only for the given roles; anyone else is sent to their own home. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    if (auth.hasRole(...roles)) return true;
    return inject(Router).parseUrl(auth.isLoggedIn() ? homeFor(auth.role()) : '/login');
  };
}

/** Login and sign-up pages: whoever already has a session goes straight to their home. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).parseUrl(homeFor(auth.role())) : true;
};
