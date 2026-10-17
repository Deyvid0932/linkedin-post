import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const api = new URL(environment.apiUrl, window.location.origin);
  const destination = new URL(req.url, window.location.origin);
  const isApi =
    (destination.origin === api.origin ||
      (req.url.startsWith('/') &&
        !req.url.startsWith('//') &&
        destination.origin === window.location.origin)) &&
    (destination.pathname === api.pathname || destination.pathname.startsWith(api.pathname + '/'));
  let requestToForward = req;
  if (token && isApi) {
    requestToForward = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
  }

  return next(requestToForward).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el backend devuelve 401 o 403 en una ruta protegida (token expirado o inválido)
      if (
        isApi &&
        error.status === 401 &&
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
    }),
  );
};
