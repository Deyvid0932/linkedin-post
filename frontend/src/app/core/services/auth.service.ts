import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'saas_auth_token';
  private readonly USER_KEY = 'saas_auth_user';
  private readonly sessionState = signal<'unknown' | 'checking' | 'authenticated' | 'anonymous'>('unknown');
  private sessionRequest?: Observable<boolean>;

  readonly currentUserSignal = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => this.sessionState() === 'authenticated');

  isSessionCheckInProgress(): boolean {
    return this.sessionState() === 'checking';
  }

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Remove credentials written by older AutoPost versions. Authentication now lives in an HttpOnly cookie.
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/login`, credentials)
      .pipe(tap((response) => this.saveSession(response)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/auth/register`, data)
      .pipe(tap((response) => this.saveSession(response)));
  }

  acceptInvitation(token: string, name: string, password: string): Observable<{ email: string; message: string }> {
    return this.http.post<{ email: string; message: string }>(`${this.API_URL}/auth/invitations/accept`, {
      token,
      name,
      password,
    });
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/forgot-password`, { email });
  }

  verifyResetCode(email: string, code: string): Observable<{ valid: boolean; message?: string }> {
    return this.http.post<{ valid: boolean; message?: string }>(
      `${this.API_URL}/auth/verify-code`,
      { email, code },
    );
  }

  resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/reset-password`, {
      email,
      code,
      newPassword,
    });
  }

  updateProfile(name?: string, currentPassword?: string, newPassword?: string): Observable<any> {
    const payload: Record<string, string> = {};
    if (name && name.trim()) payload['name'] = name.trim();
    if (currentPassword && currentPassword.trim())
      payload['currentPassword'] = currentPassword.trim();
    if (newPassword && newPassword.trim()) payload['newPassword'] = newPassword.trim();

    return this.http.put(`${this.API_URL}/users/me`, payload).pipe(
      tap((updatedUser: any) => {
        const current = this.currentUserSignal();
        if (current) {
          const updated: UserProfile = {
            ...current,
            name: updatedUser.name || current.name,
          };
          this.currentUserSignal.set(updated);
        }
      }),
    );
  }

  revokeSessions(currentPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/users/me/revoke-sessions`, {
      currentPassword,
    });
  }

  refreshCurrentUser(): Observable<UserProfile> {
    return this.http.get<{
      id: string;
      tenantId: string;
      name: string;
      email: string;
      roles: string[];
    }>(`${this.API_URL}/users/me`).pipe(
      map((response): UserProfile => ({
        userId: response.id,
        tenantId: response.tenantId,
        name: response.name,
        email: response.email,
        roles: response.roles,
      })),
      tap((updated) => {
        this.currentUserSignal.set(updated);
        this.sessionState.set('authenticated');
      }),
    );
  }

  ensureSession(): Observable<boolean> {
    const state = this.sessionState();
    if (state === 'authenticated') return of(true);
    if (state === 'anonymous') return of(false);
    if (this.sessionRequest) return this.sessionRequest;

    this.sessionState.set('checking');
    this.sessionRequest = this.refreshCurrentUser().pipe(
      map(() => true),
      catchError(() => {
        this.currentUserSignal.set(null);
        this.sessionState.set('anonymous');
        return of(false);
      }),
      finalize(() => (this.sessionRequest = undefined)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.sessionRequest;
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.API_URL}/users/me`).pipe(tap(() => this.logout()));
  }

  logout(queryParams?: Record<string, string>): void {
    this.clearLocalSession();
    this.http.post<void>(`${this.API_URL}/auth/logout`, {}).subscribe({ error: () => undefined });
    if (queryParams) this.router.navigate(['/auth/login'], { queryParams });
    else this.router.navigate(['/auth/login']);
  }

  private clearLocalSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSignal.set(null);
    this.sessionState.set('anonymous');
  }

  private saveSession(response: AuthResponse): void {
    const user: UserProfile = {
      userId: response.userId,
      tenantId: response.tenantId,
      name: response.name,
      email: response.email,
      roles: response.roles,
    };
    this.currentUserSignal.set(user);
    this.sessionState.set('authenticated');
  }
}
