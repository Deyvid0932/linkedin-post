import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { finalize } from 'rxjs';
import { ContentDraft, ContentDraftService } from '../../core/services/content-draft.service';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubRepo, LinkedInAccount } from '../../core/models/credential.model';
import {
  GitHubLinkedInBinding,
  GitHubLinkedInBindingService,
} from '../../core/services/github-linkedin-binding.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [RouterLink, DialogComponent],
  templateUrl: './queue.component.html',
})
export class QueueComponent implements OnInit {
  private readonly service = inject(ContentDraftService);
  private readonly credentials = inject(CredentialService);
  private readonly bindingService = inject(GitHubLinkedInBindingService);
  readonly confirmation = signal<{
    repository: GitHubRepo;
    account: LinkedInAccount;
    ids: string[];
    first: string;
    displayDate: string;
    timezone: string;
  } | null>(null);
  readonly drafts = signal<ContentDraft[]>([]);
  readonly accounts = signal<LinkedInAccount[]>([]);
  readonly repositories = signal<GitHubRepo[]>([]);
  readonly binding = signal<GitHubLinkedInBinding | null>(null);
  readonly bindingLoading = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly action = signal('');
  readonly githubUrl = signal('');
  readonly accountId = signal('');
  readonly repositoryId = signal('');
  readonly firstPostAt = signal(this.defaultStart());
  readonly queuedDrafts = computed(() => this.drafts().filter((draft) => draft.queued));
  readonly selectedDrafts = computed(() =>
    this.queuedDrafts().filter((draft) => draft.targetCredentialId === this.accountId()),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (drafts) => this.drafts.set(drafts),
        error: () => this.error.set('No pudimos cargar las publicaciones. Vuelve a intentarlo.'),
      });
    this.credentials.getLinkedInAccounts().subscribe({
      next: (accounts) => {
        const enabled = accounts.filter(
          (account) =>
            account.accountType === 'PERSON' && account.isEnabled && account.status === 'ACTIVE',
        );
        this.accounts.set(enabled);
        if (!this.accountId())
          this.accountId.set(
            enabled.find((account) => account.isPrimary)?.id || enabled[0]?.id || '',
          );
      },
      error: () => this.error.set('No pudimos cargar las cuentas de LinkedIn. Revisa Conexiones.'),
    });
    this.credentials.getMonitoredRepos().subscribe({
      next: (repos) => {
        const active = repos.filter((repo) => repo.isActive);
        this.repositories.set(active);
        if (active.length) {
          this.repositoryId.set(active[0].id);
          this.loadBinding(active[0].id);
        }
      },
      error: () =>
        this.error.set(
          'No pudimos cargar los repositorios. Reintenta o revisa la conexión de GitHub.',
        ),
    });
  }

  selectRepository(id: string): void {
    this.repositoryId.set(id);
    this.accountId.set('');
    this.binding.set(null);
    if (id) this.loadBinding(id);
  }

  private loadBinding(repositoryId: string): void {
    this.bindingLoading.set(true);
    this.bindingService
      .get(repositoryId)
      .pipe(finalize(() => this.bindingLoading.set(false)))
      .subscribe({
        next: (link) => {
          this.binding.set(link);
          this.accountId.set(link.accountId);
        },
        error: () => {
          this.binding.set(null);
          this.accountId.set('');
        },
      });
  }

  accountName(id?: string | null): string {
    return (
      this.accounts().find((account) => account.id === id)?.displayName || 'Cuenta de LinkedIn'
    );
  }

  downloadQueue(): void {
    this.error.set('');
    this.message.set('');
    const account = this.accounts().find((item) => item.id === this.accountId());
    const firstDate = new Date(this.firstPostAt());
    const drafts = this.selectedDrafts();
    if (!this.binding() || this.binding()?.status !== 'SYNCED') {
      this.error.set('Vincula y sincroniza primero una cuenta personal desde Canales → GitHub.');
      return;
    }
    if (!account || !Number.isFinite(firstDate.getTime()) || firstDate.getTime() <= Date.now()) {
      this.error.set('Elige una cuenta y una fecha futura para el primer post.');
      return;
    }
    if (!drafts.length) {
      this.error.set('No hay posts aprobados para esta cuenta.');
      return;
    }
    if (drafts.some((draft) => draft.imageUrl && !draft.imageUrl.startsWith('data:image/'))) {
      this.error.set('Vuelve a adjuntar las imágenes desde tu dispositivo antes de exportar.');
      return;
    }
    const posts = drafts.map((draft, index) => {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + index);
      return {
        id: draft.id,
        approved: true,
        text: draft.text,
        imageDataUrl: draft.imageUrl || null,
        publishAt: date.toISOString(),
      };
    });
    const blob = new Blob(
      [JSON.stringify({ version: 1, authorUrn: account.authorUrn, posts }, null, 2)],
      { type: 'application/json' },
    );
    if (blob.size > 50 * 1024 * 1024) {
      this.error.set('La cola supera 50 MB. Exporta menos imágenes o reduce su tamaño.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'queue.json';
    link.click();
    URL.revokeObjectURL(url);
    this.message.set(
      `Exportados ${posts.length} posts, uno por día. Súbelo a automation/queue.json en GitHub.`,
    );
  }

  uploadQueue(): void {
    this.error.set('');
    this.message.set('');
    this.githubUrl.set('');
    const first = new Date(this.firstPostAt());
    const repository = this.repositories().find((repo) => repo.id === this.repositoryId());
    const account = this.accounts().find((item) => item.id === this.accountId());
    const drafts = this.selectedDrafts();
    if (
      !repository ||
      !account ||
      !Number.isFinite(first.getTime()) ||
      first.getTime() <= Date.now() ||
      drafts.length < 1 ||
      drafts.length > 100
    ) {
      this.error.set('Elige repositorio, cuenta, fecha futura y entre 1 y 100 posts aprobados.');
      return;
    }
    if (this.busy()) return;
    this.confirmation.set({
      repository,
      account,
      ids: drafts.map((d) => d.id),
      first: first.toISOString(),
      displayDate: first.toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  confirmUpload(): void {
    const c = this.confirmation();
    if (!c || this.busy()) return;
    if (Date.parse(c.first) <= Date.now()) {
      this.confirmation.set(null);
      this.error.set('La primera fecha ya pasó. Elige una fecha futura.');
      return;
    }
    this.confirmation.set(null);
    this.busy.set(true);
    this.action.set(`Subiendo la cola a ${c.repository.repoOwner}/${c.repository.repoName}…`);
    this.service
      .uploadQueue(c.repository.id, c.account.id, c.first, c.timezone, c.ids)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.githubUrl.set(result.url);
          this.message.set(
            `Cola guardada en GitHub: ${result.postCount} posts (${result.branch}).`,
          );
        },
        error: (err) =>
          this.error.set(
            err?.error?.message ||
              'No se confirmó la subida. Revisa el repositorio antes de reintentar.',
          ),
      });
  }

  private defaultStart(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
}
