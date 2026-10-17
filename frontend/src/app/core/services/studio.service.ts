import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SwipeBatch, SwipeVersion, TokenEstimateResponse } from '../models/studio.model';

@Injectable({
  providedIn: 'root',
})
export class StudioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/publications`;

  generateBatch(
    sourceMode: string,
    selectedRepoId?: string,
    headlineTopic?: string,
    count: number = 3,
  ): Observable<SwipeBatch> {
    const payload: any = {
      sourceMode,
      count,
    };
    if (selectedRepoId) payload.selectedRepoId = selectedRepoId;
    if (headlineTopic) payload.headlineTopic = headlineTopic;

    return this.http.post<SwipeBatch>(`${this.apiUrl}/generate-batch`, payload);
  }

  estimateTokens(text: string): Observable<TokenEstimateResponse> {
    return this.http.post<TokenEstimateResponse>(`${this.apiUrl}/estimate-tokens`, { text });
  }

  testPrompt(
    customPrompt: string,
    sampleTopic?: string,
  ): Observable<{ generatedText: string; tokensUsed: number; costUsd: number }> {
    return this.http.post<{ generatedText: string; tokensUsed: number; costUsd: number }>(
      `${this.apiUrl}/test-prompt`,
      { customPrompt, sampleTopic },
    );
  }

  saveDraft(payload: {
    topicTitle: string;
    generatedText: string;
    imageUrl?: string;
    imageUrls?: string[];
    sourceMode: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/drafts`, payload);
  }

  queueDraft(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/drafts/${id}/queue`, {});
  }

  publishNow(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/publish-now`, payload);
  }

  getQueueCount(): Observable<{ queueCount: number }> {
    return this.http.get<{ queueCount: number }>(`${this.apiUrl}/queue-count`);
  }

  fetchSwipeBatch(
    sourceMode: string,
    headlineTopic?: string,
    repoId?: string,
    lazy: boolean = true,
    postLength: string = 'DETAILED',
  ): Observable<SwipeBatch> {
    let url = `${this.apiUrl}/swipe-batch?mode=${sourceMode}&lazy=${lazy}&postLength=${postLength}`;
    if (sourceMode === 'RESEARCH' && headlineTopic) {
      url += `&customTopic=${encodeURIComponent(headlineTopic)}`;
    } else if (sourceMode === 'GITHUB' && repoId) {
      url += `&customTopic=${encodeURIComponent(repoId)}`;
    }
    return this.http.get<SwipeBatch>(url);
  }

  fetchSingleVersion(
    approach: string,
    sourceMode: string,
    headlineTopic?: string,
    repoId?: string,
    postLength: string = 'DETAILED',
  ): Observable<SwipeVersion> {
    let url = `${this.apiUrl}/swipe-version?approach=${encodeURIComponent(approach)}&mode=${sourceMode}&postLength=${postLength}`;
    if (sourceMode === 'RESEARCH' && headlineTopic) {
      url += `&customTopic=${encodeURIComponent(headlineTopic)}`;
    } else if (sourceMode === 'GITHUB' && repoId) {
      url += `&customTopic=${encodeURIComponent(repoId)}`;
    }
    return this.http.get<SwipeVersion>(url);
  }

  searchImage(query: string): Observable<{ imageUrl: string }> {
    return this.http.get<{ imageUrl: string }>(
      `${this.apiUrl}/search-image?query=${encodeURIComponent(query)}`,
    );
  }

  sendFeedback(body: {
    structureTitle: string;
    generatedText: string;
    rating: string;
    topicTitle: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, body);
  }
}
