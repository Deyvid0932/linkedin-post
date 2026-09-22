import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GeneratedPreview, PublicationLog } from '../models/publication.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class PublicationService {
  private readonly API_URL = `${environment.apiUrl}/publications`;

  constructor(private http: HttpClient) {}

  getHistory(page: number = 0, size: number = 50): Observable<PageResponse<PublicationLog>> {
    return this.http.get<PageResponse<PublicationLog>>(`${this.API_URL}?page=${page}&size=${size}`);
  }

  getQueue(): Observable<PublicationLog[]> {
    return this.http.get<PublicationLog[]>(`${this.API_URL}/queue`);
  }

  deleteFromQueue(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/queue/${id}`);
  }

  publishQueuedNow(id: string): Observable<{ success: boolean; message: string; linkedinUrn?: string }> {
    return this.http.post<{ success: boolean; message: string; linkedinUrn?: string }>(`${this.API_URL}/queue/${id}/publish-now`, {});
  }

  deletePublication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  retryPublication(id: string): Observable<{ success: boolean; message: string; linkedinUrn?: string; log?: PublicationLog }> {
    return this.http.post<{ success: boolean; message: string; linkedinUrn?: string; log?: PublicationLog }>(`${this.API_URL}/${id}/retry`, {});
  }

  republishPost(id: string): Observable<{ success: boolean; message: string; linkedinUrn?: string }> {
    return this.http.post<{ success: boolean; message: string; linkedinUrn?: string }>(`${this.API_URL}/${id}/republish`, {});
  }

  clearHistory(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/history/clear`);
  }

  triggerPipeline(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/trigger`, {});
  }

  getPreview(): Observable<GeneratedPreview> {
    return this.http.get<GeneratedPreview>(`${this.API_URL}/preview`);
  }

  generatePreview(): Observable<GeneratedPreview> {
    return this.http.post<GeneratedPreview>(`${this.API_URL}/preview/generate`, {});
  }

  publishPreviewNow(text?: string, imageUrl?: string): Observable<{ success: boolean; message: string; linkedinUrn?: string; log?: PublicationLog }> {
    return this.http.post<{ success: boolean; message: string; linkedinUrn?: string; log?: PublicationLog }>(
      `${this.API_URL}/preview/publish-now`,
      { text, imageUrl }
    );
  }
}
