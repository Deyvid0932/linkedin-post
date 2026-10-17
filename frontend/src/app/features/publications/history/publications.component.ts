import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  finalize,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HistoryFilters, PublicationService } from '../../../core/services/publication.service';
import { ContentDraftService } from '../../../core/services/content-draft.service';
import { PublicationLog } from '../../../core/models/publication.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { CredentialService } from '../../../core/services/credential.service';
import { GitHubAutomationService } from '../../../core/services/github-automation.service';
import { GitHubRepo } from '../../../core/models/credential.model';
@Component({
  selector: 'app-publications',
  standalone: true,
  imports: [DatePipe, DialogComponent],
  templateUrl: './publications.component.html',
})
export class PublicationsComponent implements OnInit {
  private readonly service = inject(PublicationService);
  private readonly drafts = inject(ContentDraftService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly credentials = inject(CredentialService);
  private readonly githubAutomation = inject(GitHubAutomationService);
  private readonly requests = new Subject<void>();
  private readonly searchChanges = new Subject<void>();
  readonly search = signal('');
  readonly status = signal<HistoryFilters['status']>(undefined);
  readonly source = signal<HistoryFilters['sourceMode']>(undefined);
  readonly page = signal(0);
  readonly pages = signal(0);
  readonly total = signal(0);
  readonly posts = signal<PublicationLog[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly selected = signal<PublicationLog | null>(null);
  readonly confirmation = signal<{
    kind: 'clear' | 'delete' | 'retry' | 'republish' | 'publish';
    post?: PublicationLog;
  } | null>(null);
  readonly historyView = signal<'APP' | 'ACTIONS'>('APP');
  readonly actionsHistory = signal<Record<string, unknown>[]>([]);
  readonly actionsLoading = signal(false);
  readonly actionRepositoryId = signal('');
  readonly actionRepositories = signal<GitHubRepo[]>([]);
  readonly origins = [
    { value: undefined, label: 'Todos' },
    { value: 'PROJECT' as const, label: 'GitHub' },
    { value: 'RESEARCH' as const, label: 'Investigación IA' },
    { value: 'BACKUP' as const, label: 'Banco de ideas' },
  ];
  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.reload());
    this.requests
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set('');
          return this.service
            .getHistory(this.page(), 20, {
              search: this.search().trim(),
              status: this.status(),
              sourceMode: this.source(),
            })
            .pipe(
              catchError(() => {
                this.error.set('No pudimos cargar el historial.');
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if (result) {
          this.posts.set(result.content);
          this.pages.set(result.totalPages);
          this.total.set(result.totalElements);
        }
      });
  }
  setHistoryView(view: 'APP' | 'ACTIONS'): void {
    this.historyView.set(view);
    if (view === 'ACTIONS' && !this.actionRepositoryId()) this.loadActionHistory();
  }
  loadActionHistory(): void {
    this.actionsLoading.set(true);
    this.credentials
      .getMonitoredRepos()
      .pipe(
        switchMap((repos) => {
          const active = repos.filter((r) => r.isActive);
          this.actionRepositories.set(active);
          const repo = active.find((r) => r.id === this.actionRepositoryId()) || active[0];
          if (!repo) {
            this.actionRepositoryId.set('');
            return of([] as Record<string, unknown>[]);
          }
          this.actionRepositoryId.set(repo.id);
          return this.githubAutomation.history(repo.id);
        }),
        finalize(() => this.actionsLoading.set(false)),
      )
      .subscribe({
        next: (items) => this.actionsHistory.set(items),
        error: () => {
          this.actionsHistory.set([]);
          this.error.set('No pudimos leer el historial del repositorio conectado.');
        },
      });
  }
  selectActionRepository(repositoryId: string): void {
    this.actionRepositoryId.set(repositoryId);
    this.loadActionHistory();
  }
  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    this.searchChanges.next();
  }
  setStatus(value: HistoryFilters['status']): void {
    this.status.set(value);
    this.page.set(0);
    this.reload();
  }
  setSource(value: HistoryFilters['sourceMode']): void {
    this.source.set(value);
    this.page.set(0);
    this.reload();
  }
  go(page: number): void {
    this.page.set(page);
    this.reload();
  }
  reload(): void {
    this.requests.next();
  }
  sourceLabel(value: string): string {
    return (
      (
        { PROJECT: 'GitHub', RESEARCH: 'Investigación IA', BACKUP: 'Banco de ideas' } as Record<
          string,
          string
        >
      )[value] || value
    );
  }
  statusLabel(value: string): string {
    return (
      (
        {
          SUCCESS: 'Publicado',
          FAILED: 'Fallido',
          PENDING: 'Pendiente',
          DRAFT: 'Borrador',
        } as Record<string, string>
      )[value] || value
    );
  }
  linkedinUrl(post: PublicationLog): string | null {
    if (!post.postUrl) return null;
    try {
      const url = new URL(post.postUrl);
      return url.protocol === 'https:' &&
        (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com'))
        ? url.href
        : null;
    } catch {
      return null;
    }
  }
  duplicate(post: PublicationLog): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.drafts
      .save({
        title: (post.sourceReference || 'Copia de publicación').slice(0, 200),
        text: post.generatedText,
        tone: 'PROFESSIONAL',
        audience: 'Mi comunidad',
        goal: 'SHARE_LEARNING',
        imageUrl: post.imageUrl || null,
        targetCredentialId: null,
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (d) => this.router.navigate(['/compose'], { queryParams: { draft: d.id } }),
        error: () => this.error.set('No pudimos crear la copia. El registro original se conserva.'),
      });
  }
  ask(kind: 'clear' | 'delete' | 'retry' | 'republish' | 'publish', post?: PublicationLog): void {
    this.confirmation.set({ kind, post });
  }
  confirm(): void {
    const a = this.confirmation();
    if (!a || this.busy()) return;
    this.busy.set(true);
    const request: Observable<{ success?: boolean; message?: string } | void> =
      a.kind === 'clear'
        ? this.service.clearHistory()
        : a.kind === 'delete'
          ? this.service.deletePublication(a.post!.id)
          : a.kind === 'retry'
            ? this.service.retryPublication(a.post!.id)
            : a.kind === 'publish'
              ? this.service.publishQueuedNow(a.post!.id)
              : this.service.republishPost(a.post!.id);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (r) => {
        this.confirmation.set(null);
        this.selected.set(null);
        if (r && 'success' in r && !r.success)
          this.error.set(r.message || 'El envío no se completó.');
        else
          this.message.set(
            r && 'message' in r ? r.message || 'Acción completada.' : 'Acción completada.',
          );
        this.reload();
      },
      error: () => {
        this.confirmation.set(null);
        this.error.set('No se confirmó la acción. Revisa el resultado antes de reintentar.');
      },
    });
  }
}
