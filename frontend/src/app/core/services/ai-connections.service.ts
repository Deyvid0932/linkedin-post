import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AiProviderId = 'deepseek-text' | 'nanogpt-image';

export interface AiProviderStatus {
  provider: AiProviderId;
  label: string;
  workspaceKeyConfigured: boolean;
  serverFallbackConfigured: boolean;
  effectiveSource: 'WORKSPACE' | 'SERVER' | 'NONE';
  updatedAt: string | null;
}

export interface NanoGptImageModel {
  id: string;
  name: string;
  estimatedPriceUsd: number;
}

@Injectable({ providedIn: 'root' })
export class AiConnectionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-connections`;

  getStatuses(): Observable<AiProviderStatus[]> {
    return this.http.get<AiProviderStatus[]>(this.baseUrl);
  }

  getImageModels(): Observable<NanoGptImageModel[]> {
    return this.http.get<NanoGptImageModel[]>(`${this.baseUrl}/image-models`);
  }

  save(provider: AiProviderId, apiKey: string): Observable<AiProviderStatus> {
    return this.http.put<AiProviderStatus>(`${this.baseUrl}/${provider}`, { apiKey });
  }

  remove(provider: AiProviderId): Observable<AiProviderStatus> {
    return this.http.delete<AiProviderStatus>(`${this.baseUrl}/${provider}`);
  }
}
