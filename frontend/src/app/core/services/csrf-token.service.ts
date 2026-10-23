import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CsrfTokenService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private token: string | null = null;
  private pending?: Observable<string>;

  getToken(): Observable<string> {
    if (this.token) return of(this.token);
    if (this.pending) return this.pending;

    this.pending = this.http
      .get<{ token: string }>(`${environment.apiUrl}/auth/csrf`, { withCredentials: true })
      .pipe(
        map((response) => response.token),
        tap((token) => (this.token = token)),
        catchError((error: unknown) => {
          this.pending = undefined;
          return throwError(() => error);
        }),
        finalize(() => (this.pending = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.pending;
  }

  clear(): void {
    this.token = null;
    this.pending = undefined;
  }
}
