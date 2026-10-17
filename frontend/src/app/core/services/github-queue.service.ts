import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface GitHubQueuePost {
  id: string;
  text: string;
  hasImage: boolean;
  publishAt: string | null;
  status: 'SCHEDULED' | 'SUCCESS' | 'SENDING' | 'UNKNOWN' | string;
  attemptedAt: string | null;
  postUrn: string | null;
}

export interface GitHubQueueSnapshot {
  repositoryId: string;
  repository: string;
  branch: string;
  revision: string;
  queueSha: string | null;
  posts: GitHubQueuePost[];
}

@Injectable({ providedIn: 'root' })
export class GitHubQueueService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/content/github-queue`;

  load(repositoryId: string) {
    return this.http.get<GitHubQueueSnapshot>(this.url, { params: { repositoryId } });
  }

  schedule(
    repositoryId: string,
    postId: string,
    publishAt: string,
    timezone: string,
    expectedRevision: string,
  ) {
    return this.http.patch<{ queue: GitHubQueueSnapshot; commitUrl: string }>(
      `${this.url}/${encodeURIComponent(postId)}/schedule`,
      { publishAt, timezone, expectedRevision },
      { params: { repositoryId } },
    );
  }
}
