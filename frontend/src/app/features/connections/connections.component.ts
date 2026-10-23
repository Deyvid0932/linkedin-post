import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AiConnectionsService, AiProviderStatus } from '../../core/services/ai-connections.service';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubRepo, GitHubStatus, LinkedInAccount } from '../../core/models/credential.model';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './connections.component.html',
  styleUrl: './connections.component.css',
})
export class ConnectionsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly credentials = inject(CredentialService);
  private readonly aiConnections = inject(AiConnectionsService);

  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly linkedinAccounts = signal<LinkedInAccount[] | null>(null);
  readonly linkedinError = signal('');
  readonly githubStatus = signal<GitHubStatus | null>(null);
  readonly githubError = signal('');
  readonly repos = signal<GitHubRepo[] | null>(null);
  readonly reposError = signal('');
  readonly aiStatuses = signal<AiProviderStatus[] | null>(null);
  readonly aiError = signal('');
  readonly activeLinkedInCount = computed(
    () => this.linkedinAccounts()?.filter((account) => account.isEnabled && account.isValid && account.status === 'ACTIVE').length ?? 0,
  );
  readonly expiredLinkedInCount = computed(
    () => this.linkedinAccounts()?.filter((account) => account.status === 'EXPIRED').length ?? 0,
  );
  readonly activeRepoCount = computed(() => this.repos()?.filter((repo) => repo.isActive).length ?? 0);
  readonly configuredAiCount = computed(
    () => this.aiStatuses()?.filter((provider) => provider.effectiveSource !== 'NONE').length ?? 0,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.linkedinError.set('');
    this.githubError.set('');
    this.reposError.set('');
    this.aiError.set('');

    forkJoin({
      linkedin: this.credentials.getLinkedInAccounts().pipe(
        map((value) => ({ value, error: '' })),
        catchError(() => of({ value: null, error: 'No se pudo consultar el estado de LinkedIn.' })),
      ),
      github: this.credentials.getGitHubStatus().pipe(
        map((value) => ({ value, error: '' })),
        catchError(() => of({ value: null, error: 'No se pudo consultar el estado de GitHub.' })),
      ),
      repos: this.credentials.getMonitoredRepos().pipe(
        map((value) => ({ value, error: '' })),
        catchError(() => of({ value: null, error: 'No se pudo consultar la lista de repositorios.' })),
      ),
      ai: this.aiConnections.getStatuses().pipe(
        map((value) => ({ value, error: '' })),
        catchError(() => of({ value: null, error: 'No se pudo consultar el estado de los proveedores de IA.' })),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ linkedin, github, repos, ai }) => {
        this.linkedinAccounts.set(linkedin.value);
        this.linkedinError.set(linkedin.error);
        this.githubStatus.set(github.value);
        this.githubError.set(github.error);
        this.repos.set(repos.value);
        this.reposError.set(repos.error);
        this.aiStatuses.set(ai.value);
        this.aiError.set(ai.error);
        this.loaded.set(true);
        this.loading.set(false);
      });
  }

  aiSourceLabel(source: AiProviderStatus['effectiveSource']): string {
    switch (source) {
      case 'WORKSPACE':
        return 'Clave del espacio';
      case 'SERVER':
        return 'Servidor';
      default:
        return 'Sin configurar';
    }
  }
}
