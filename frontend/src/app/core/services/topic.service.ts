import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BackupTopic } from '../models/topic.model';

export interface BulkTopicItemRequest {
  title: string;
  description?: string;
  category?: string;
  priority?: number;
  isAiResearch?: boolean;
}

export interface BulkTopicRequestPayload {
  reorderList?: Array<{ id: string; priority: number }>;
  backupTopics?: BulkTopicItemRequest[];
  rawBulkText?: string;
  isAiResearchDefault?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TopicService {
  private readonly API_URL = `${environment.apiUrl}/topics`;

  constructor(private http: HttpClient) {}

  getTopics(): Observable<BackupTopic[]> {
    return this.http.get<BackupTopic[]>(this.API_URL);
  }

  addTopic(data: {
    title: string;
    description?: string;
    category?: string;
    priority?: number;
    isAiResearch?: boolean;
  }): Observable<BackupTopic> {
    return this.http.post<BackupTopic>(this.API_URL, data);
  }

  addBulkTopics(
    payload: BulkTopicRequestPayload,
  ): Observable<{ message: string; importedCount: number }> {
    return this.http.post<{ message: string; importedCount: number }>(
      `${this.API_URL}/bulk`,
      payload,
    );
  }

  toggleTopicType(id: string): Observable<BackupTopic> {
    return this.http.patch<BackupTopic>(`${this.API_URL}/${id}/toggle-type`, {});
  }

  toggleTopicStatus(id: string): Observable<BackupTopic> {
    return this.http.patch<BackupTopic>(`${this.API_URL}/${id}/toggle-status`, {});
  }

  resetTopicUsed(id: string): Observable<BackupTopic> {
    return this.http.patch<BackupTopic>(`${this.API_URL}/${id}/reset-used`, {});
  }

  toggleTopicUsed(id: string): Observable<BackupTopic> {
    return this.http.patch<BackupTopic>(`${this.API_URL}/${id}/toggle-used`, {});
  }

  reorderTopics(
    items: Array<{ id: string; priority: number }>,
  ): Observable<{ message: string; count: number }> {
    return this.http.put<{ message: string; count: number }>(`${this.API_URL}/reorder`, items);
  }

  deleteTopic(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  clearAllTopics(): Observable<{ message: string; count?: number }> {
    return this.http.delete<{ message: string; count?: number }>(`${this.API_URL}/clear-all`);
  }
}
