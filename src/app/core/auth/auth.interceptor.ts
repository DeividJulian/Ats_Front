import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_URL } from '../config/api.config';
import { AuthService } from './auth.service';

/**
 * Adds the session token to every request to our backend (never to other sites),
 * and closes the session when the server says it is no longer valid.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApi = request.url.startsWith(API_URL);

  const authorized =
    isApi && token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const isLoginAttempt = request.url.startsWith(`${API_URL}/auth/login`);
      if (isApi && !isLoginAttempt && error instanceof HttpErrorResponse && error.status === 401 && auth.token()) {
        auth.logout('/login?expired=1');
      }
      return throwError(() => error);
    }),
  );
};
