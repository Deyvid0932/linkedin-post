import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface GitHubLinkedInBinding {
  repositoryId: string;
  repository: string;
  accountId: string;
  accountName: string;
  status: 'SYNCED' | 'PENDING' | string;
  lastSyncedAt: string | null;
  errorCode: string | null;
}

@Injectable({ providedIn: 'root' })
export class GitHubLinkedInBindingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/automation/github-linkedin-binding`;
  get(repositoryId: string) {
    return this.http.get<GitHubLinkedInBinding>(this.url, { params: { repositoryId } });
  }
  save(repositoryId: string, accountId: string) {
    return this.http.put<GitHubLinkedInBinding>(
      this.url,
      { accountId },
      { params: { repositoryId } },
    );
  }
  retry(repositoryId: string) {
    return this.http.post<GitHubLinkedInBinding>(
      `${this.url}/sync`,
      {},
      { params: { repositoryId } },
    );
  }
  disconnect(repositoryId: string) {
    return this.http.delete<void>(this.url, { params: { repositoryId } });
  }
}
