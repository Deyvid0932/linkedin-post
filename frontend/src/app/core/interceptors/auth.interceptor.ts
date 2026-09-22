import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  let requestToForward = req;
  if (token) {
    requestToForward = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(requestToForward).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el backend devuelve 401 o 403 en una ruta protegida (token expirado o inválido)
      if ((error.status === 401 || error.status === 403) && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
        console.warn('Sesión expirada o no autorizada (HTTP ' + error.status + '). Redirigiendo al login...');
        authService.logout();
        router.navigate(['/auth/login'], { queryParams: { expired: 'true' } });
      }
      return throwError(() => error);
    })
  );
};
