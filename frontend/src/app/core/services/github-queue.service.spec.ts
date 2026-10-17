import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitHubQueueService } from './github-queue.service';

describe('GitHubQueueService', () => {
  let service: GitHubQueueService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GitHubQueueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads only the selected repository queue', () => {
    service.load('repo-123').subscribe((result) => expect(result.repositoryId).toBe('repo-123'));
    const request = http.expectOne(
      (req) =>
        req.url.endsWith('/content/github-queue') && req.params.get('repositoryId') === 'repo-123',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      repositoryId: 'repo-123',
      repository: 'owner/repo',
      branch: 'main',
      revision: 'head',
      queueSha: 'queue-sha',
      posts: [],
    });
  });

  it('sends the expected revision and changes only the scheduling fields', () => {
    const payload = {
      publishAt: '2030-03-04T13:00:00.000Z',
      timezone: 'America/Lima',
      expectedRevision: 'expected-head',
    };
    service
      .schedule(
        'repo-123',
        'post-456',
        payload.publishAt,
        payload.timezone,
        payload.expectedRevision,
      )
      .subscribe();
    const request = http.expectOne(
      (req) =>
        req.url.endsWith('/content/github-queue/post-456/schedule') &&
        req.params.get('repositoryId') === 'repo-123',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);
    request.flush({
      queue: {
        repositoryId: 'repo-123',
        repository: 'owner/repo',
        branch: 'main',
        revision: 'next-head',
        queueSha: 'next-queue',
        posts: [],
      },
      commitUrl: 'https://github.com/owner/repo/commit/next-head',
    });
  });
});
