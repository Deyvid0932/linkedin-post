import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ComposePayload {
  title: string;
  text: string;
  tone: string;
  audience: string;
  goal: string;
  instructions?: string;
  imageUrl?: string | null;
  targetCredentialId?: string | null;
}
export interface ContentDraft extends ComposePayload {
  id: string;
  queued: boolean;
  updatedAt: string;
}
export type AdaptationChannel = 'X' | 'YOUTUBE_SHORTS' | 'TIKTOK';
export interface AdaptedContent {
  id?: string;
  channel: AdaptationChannel;
  text: string;
  characterCount: number;
  recommendedCharacters: number;
  publishingAvailable: boolean;
  updatedAt?: string;
}
@Injectable({ providedIn: 'root' })
export class ContentDraftService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/content`;
  list() {
    return this.http.get<ContentDraft[]>(`${this.url}/drafts`);
  }
  generate(payload: ComposePayload) {
    return this.http.post<{ text: string; prompt: string }>(`${this.url}/generate`, payload);
  }
  adapt(payload: ComposePayload, channel: AdaptationChannel) {
    return this.http.post<AdaptedContent>(`${this.url}/adapt`, { content: payload, channel });
  }
  listVariants(draftId: string) {
    return this.http.get<AdaptedContent[]>(`${this.url}/drafts/${draftId}/variants`);
  }
  saveVariant(draftId: string, variant: Pick<AdaptedContent, 'channel' | 'text'>) {
    return this.http.put<AdaptedContent>(`${this.url}/drafts/${draftId}/variants`, variant);
  }
  save(payload: ComposePayload, id?: string) {
    return id
      ? this.http.put<ContentDraft>(`${this.url}/drafts/${id}`, payload)
      : this.http.post<ContentDraft>(`${this.url}/drafts`, payload);
  }
  approve(id: string) {
    return this.http.post<ContentDraft>(`${this.url}/drafts/${id}/approve`, {});
  }
  unqueue(id: string) {
    return this.http.post<ContentDraft>(`${this.url}/drafts/${id}/unqueue`, {});
  }
}
