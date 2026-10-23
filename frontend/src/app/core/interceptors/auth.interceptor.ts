import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CsrfTokenService } from '../services/csrf-token.service';
import { environment } from '../../../environments/environment';

const CSRF_RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const csrfTokenService = inject(CsrfTokenService);
  const router = inject(Router);

  const api = new URL(environment.apiUrl, window.location.origin);
  const destination = new URL(req.url, window.location.origin);
  const isApi =
    (destination.origin === api.origin ||
      (req.url.startsWith('/') &&
        !req.url.startsWith('//') &&
        destination.origin === window.location.origin)) &&
    (destination.pathname === api.pathname || destination.pathname.startsWith(api.pathname + '/'));
  const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method.toUpperCase());

  const forward = (csrfToken?: string, retriedCsrf = false): Observable<HttpEvent<unknown>> => {
    let requestToForward = req.clone({
      withCredentials: isApi || req.withCredentials,
      context: retriedCsrf ? req.context.set(CSRF_RETRIED, true) : req.context,
    });
    if (isApi && csrfToken) {
      requestToForward = requestToForward.clone({ headers: requestToForward.headers.set('X-XSRF-TOKEN', csrfToken) });
    }
    return next(requestToForward);
  };

  const handleError = (
    error: HttpErrorResponse,
    retriedCsrf: boolean,
  ): Observable<HttpEvent<unknown>> => {
    if (
      isApi &&
      isUnsafeMethod &&
      error.status === 403 &&
      !retriedCsrf &&
      !req.context.get(CSRF_RETRIED)
    ) {
      csrfTokenService.clear();
      return run(true);
    }
    if (
      isApi &&
      error.status === 401 &&
      !authService.isSessionCheckInProgress() &&
      !destination.pathname.includes('/auth/') &&
      !destination.pathname.includes('/automation/')
    ) {
      console.warn(
        'Sesión expirada o no autorizada (HTTP ' + error.status + '). Redirigiendo al login...',
      );
      authService.logout();
      router.navigate(['/auth/login'], { queryParams: { expired: 'true' } });
    }
    return throwError(() => error);
  };

  const run = (retriedCsrf: boolean): Observable<HttpEvent<unknown>> => {
    const response = isApi && isUnsafeMethod && !destination.pathname.endsWith('/auth/csrf')
      ? csrfTokenService.getToken().pipe(switchMap((token) => forward(token, retriedCsrf)))
      : forward(undefined, retriedCsrf);
    return response.pipe(catchError((error: HttpErrorResponse) => handleError(error, retriedCsrf)));
  };

  return run(false);
};
