import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'saas_auth_token';
  private readonly USER_KEY = 'saas_auth_user';

  // Signals para Reactividad y Estado Global
  readonly tokenSignal = signal<string | null>(this.getStoredToken());
  readonly currentUserSignal = signal<UserProfile | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.tokenSignal());

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap(response => this.saveSession(response))
    );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/register`, data).pipe(
      tap(response => this.saveSession(response))
    );
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/forgot-password`, { email });
  }

  verifyResetCode(email: string, code: string): Observable<{ valid: boolean; message?: string }> {
    return this.http.post<{ valid: boolean; message?: string }>(`${this.API_URL}/auth/verify-code`, { email, code });
  }

  resetPasswordWithCode(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/auth/reset-password`, { email, code, newPassword });
  }

  updateProfile(name?: string, currentPassword?: string, newPassword?: string): Observable<any> {
    const payload: Record<string, string> = {};
    if (name && name.trim()) payload['name'] = name.trim();
    if (currentPassword && currentPassword.trim()) payload['currentPassword'] = currentPassword.trim();
    if (newPassword && newPassword.trim()) payload['newPassword'] = newPassword.trim();

    return this.http.put(`${this.API_URL}/users/me`, payload).pipe(
      tap((updatedUser: any) => {
        const current = this.currentUserSignal();
        if (current) {
          const updated: UserProfile = {
            ...current,
            name: updatedUser.name || current.name
          };
          localStorage.setItem(this.USER_KEY, JSON.stringify(updated));
          this.currentUserSignal.set(updated);
        }
      })
    );
  }

  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.API_URL}/users/me`).pipe(
      tap(() => this.logout())
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.tokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    const user: UserProfile = {
      userId: response.userId,
      tenantId: response.tenantId,
      name: response.name,
      email: response.email,
      roles: response.roles
    };
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));

    this.tokenSignal.set(response.token);
    this.currentUserSignal.set(user);
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): UserProfile | null {
    const data = localStorage.getItem(this.USER_KEY);
    return data ? JSON.parse(data) : null;
  }
}
