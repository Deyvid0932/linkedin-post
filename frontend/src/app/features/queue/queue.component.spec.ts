import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { QueueComponent } from './queue.component';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubLinkedInBindingService } from '../../core/services/github-linkedin-binding.service';

describe('Queue workflow', () => {
  const draft = {
    id: 'draft-1',
    title: 'Idea',
    text: 'A reviewed post',
    tone: 'TECHNICAL',
    audience: 'Developers',
    goal: 'TEACH',
    targetCredentialId: 'account-1',
    queued: true,
    updatedAt: '2026-10-04',
  };
  let component: QueueComponent;
  let service: { list: ReturnType<typeof vi.fn>; uploadQueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn(() => of([draft])),
      uploadQueue: vi.fn(() =>
        of({ postCount: 1, branch: 'main', url: 'https://github.com/owner/queue/actions' }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [QueueComponent],
      providers: [
        provideRouter([]),
        { provide: ContentDraftService, useValue: service },
        {
          provide: CredentialService,
          useValue: {
            getLinkedInAccounts: () =>
              of([
                {
                  id: 'account-1',
                  accountType: 'PERSON',
                  authorUrn: 'urn:li:person:test',
                  displayName: 'Mi perfil',
                  isEnabled: true,
                  isPrimary: true,
                  status: 'ACTIVE',
                },
              ]),
            getMonitoredRepos: () =>
              of([{ id: 'repo-1', repoOwner: 'owner', repoName: 'queue', isActive: true }]),
          },
        },
        {
          provide: GitHubLinkedInBindingService,
          useValue: {
            get: () =>
              of({
                repositoryId: 'repo-1',
                repository: 'owner/queue',
                accountId: 'account-1',
                accountName: 'Mi perfil',
                status: 'SYNCED',
                lastSyncedAt: null,
                errorCode: null,
              }),
          },
        },
      ],
    });
    component = TestBed.createComponent(QueueComponent).componentInstance;
    component.drafts.set([draft]);
    component.accounts.set([
      {
        id: 'account-1',
        accountType: 'PERSON',
        authorUrn: 'urn:li:person:test',
        displayName: 'Mi perfil',
        isEnabled: true,
        isPrimary: true,
        status: 'ACTIVE',
      } as never,
    ]);
    component.repositories.set([
      { id: 'repo-1', repoOwner: 'owner', repoName: 'queue', isActive: true } as never,
    ]);
    component.binding.set({
      repositoryId: 'repo-1',
      repository: 'owner/queue',
      accountId: 'account-1',
      accountName: 'Mi perfil',
      status: 'SYNCED',
      lastSyncedAt: null,
      errorCode: null,
    });
    component.accountId.set('account-1');
    component.repositoryId.set('repo-1');
    component.firstPostAt.set('2099-01-01T09:00');
  });

  it('requires confirmation and uploads only approved posts for the selected account', () => {
    component.uploadQueue();
    component.confirmUpload();
    expect(component.confirmation()).toBeNull();
    expect(service.uploadQueue).toHaveBeenCalledWith(
      'repo-1',
      'account-1',
      expect.any(String),
      expect.any(String),
      ['draft-1'],
    );
    expect(component.githubUrl()).toBe('https://github.com/owner/queue/actions');
  });

  it('asks before replacing the queue and shows the scope of replacement', () => {
    component.uploadQueue();
    expect(service.uploadQueue).not.toHaveBeenCalled();
    expect(component.confirmation()?.ids).toEqual(['draft-1']);
    expect(component.confirmation()?.repository.repoName).toBe('queue');
  });

  it('does not upload if no approved post matches the chosen account', () => {
    component.binding.set({
      repositoryId: 'repo-1',
      repository: 'owner/queue',
      accountId: 'account-1',
      accountName: 'Mi perfil',
      status: 'SYNCED',
      lastSyncedAt: null,
      errorCode: null,
    });
    component.drafts.set([{ ...draft, targetCredentialId: 'other-account' }]);
    component.uploadQueue();
    component.confirmUpload();
    expect(service.uploadQueue).not.toHaveBeenCalled();
    expect(component.error()).toContain('entre 1 y 100');
  });

  it('reports an unconfirmed GitHub write without clearing the queue', () => {
    service.uploadQueue.mockReturnValue(throwError(() => ({ status: 502 })));
    component.uploadQueue();
    component.confirmUpload();
    expect(component.error()).toContain('No se confirmó');
    expect(component.drafts()).toHaveLength(1);
    expect(component.busy()).toBe(false);
  });

  it('requires a future date to download the queue', () => {
    component.firstPostAt.set('2000-01-01T09:00');
    component.downloadQueue();
    expect(component.error()).toContain('fecha futura');
  });
});
