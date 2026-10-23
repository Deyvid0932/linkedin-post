import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AppearanceSettings,
  DashboardStats,
  TenantAppearancePolicyRequest,
  TenantProfileRequest,
  TenantResponse,
} from '../models/tenant.model';

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private readonly API_URL = `${environment.apiUrl}/tenant`;
  private readonly APPEARANCE_URL = `${environment.apiUrl}/appearance`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<TenantResponse> {
    return this.http.get<TenantResponse>(`${this.API_URL}/profile`);
  }

  getTenantInfo(): Observable<TenantResponse> {
    return this.getProfile();
  }

  updateProfile(data: TenantProfileRequest): Observable<TenantResponse> {
    return this.http.put<TenantResponse>(`${this.API_URL}/profile`, data);
  }

  updateTenant(systemPrompt: string, timezone: string): Observable<TenantResponse> {
    return this.updateProfile({ systemPrompt, timezone });
  }

  getAppearance(): Observable<AppearanceSettings> {
    return this.http.get<AppearanceSettings>(this.APPEARANCE_URL);
  }

  updateAppearancePolicy(data: TenantAppearancePolicyRequest): Observable<AppearanceSettings> {
    return this.http.put<AppearanceSettings>(`${this.APPEARANCE_URL}/policy`, data);
  }

  updateUserAccent(accentColor: AppearanceSettings['userAccentColor']): Observable<AppearanceSettings> {
    return this.http.put<AppearanceSettings>(`${environment.apiUrl}/users/me/appearance`, {
      accentColor,
    });
  }

  testPrompt(testPrompt: string, sampleTopic: string) {
    return this.http.post<{
      success: boolean;
      generatedSample: string;
      topic: string;
      approach: string;
    }>(`${this.API_URL}/prompt/test`, { testPrompt, sampleTopic, approach: 'EXPERT' });
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.API_URL}/dashboard`);
  }

  emergencyPause(): Observable<{ message: string; isEmergencyPaused: boolean }> {
    return this.http.post<{ message: string; isEmergencyPaused: boolean }>(
      `${this.API_URL}/emergency-pause`,
      {},
    );
  }

  emergencyResume(): Observable<{ message: string; isEmergencyPaused: boolean }> {
    return this.http.post<{ message: string; isEmergencyPaused: boolean }>(
      `${this.API_URL}/emergency-resume`,
      {},
    );
  }

  toggleDryRun(isDryRun: boolean): Observable<{ message: string; isDryRun: boolean }> {
    return this.http.patch<{ message: string; isDryRun: boolean }>(`${this.API_URL}/dry-run`, {
      isDryRun,
    });
  }
}
