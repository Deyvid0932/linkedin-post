import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface GitHubAutomationConfig {
  approvalMode: 'REQUIRE_APPROVAL' | 'AUTOMATIC';
  targetCharacters: number;
  prompt: string;
  imageModel: string;
  timezone: string;
  publishTime: string;
  enabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class GitHubAutomationService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/automation/github-config`;
  get(repositoryId: string) {
    return this.http.get<GitHubAutomationConfig>(this.url, { params: { repositoryId } });
  }
  save(repositoryId: string, config: GitHubAutomationConfig) {
    return this.http.put<GitHubAutomationConfig>(this.url, config, { params: { repositoryId } });
  }
  pending(repositoryId: string) {
    return this.http.get<Record<string, unknown>[]>(`${this.url}/review`, {
      params: { repositoryId },
    });
  }
  approve(repositoryId: string, postId: string) {
    return this.http.post<{ id: string; status: string; message: string }>(
      `${this.url}/review/${postId}/approve`,
      {},
      { params: { repositoryId } },
    );
  }
  history(repositoryId: string) {
    return this.http.get<Record<string, unknown>[]>(`${this.url}/history`, {
      params: { repositoryId },
    });
  }
}
