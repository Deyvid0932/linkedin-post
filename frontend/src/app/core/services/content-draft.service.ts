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
  uploadQueue(
    repositoryId: string,
    accountId: string,
    firstPostAt: string,
    timezone: string,
    draftIds: string[],
  ) {
    return this.http.post<{ postCount: number; branch: string; url: string }>(
      `${this.url}/github-queue`,
      { repositoryId, accountId, firstPostAt, timezone, draftIds },
    );
  }
}
