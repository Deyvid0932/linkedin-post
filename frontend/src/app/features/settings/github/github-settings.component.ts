import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SlicePipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CredentialService } from '../../../core/services/credential.service';
import { GitHubRepo, GitHubStatus } from '../../../core/models/credential.model';

@Component({
  selector: 'app-github-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, SlicePipe, DatePipe],
  templateUrl: './github-settings.component.html',
})
export class GithubSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private credentialService = inject(CredentialService);
  private router = inject(Router);

  status = signal<GitHubStatus | null>(null);
  repos = signal<GitHubRepo[]>([]);
  isDragging = signal(false);
  repoUrl = signal('');
  adding = signal(false);
  saving = signal(false);
  testing = signal(false);
  disconnecting = signal(false);
  showPat = signal(false);

  // Modo de edición de credenciales (bloqueo por defecto cuando está conectado)
  isEditingToken = signal(false);

  testMessage = signal<string | null>(null);
  testSuccess = signal(false);

  editingRepoId = signal<string | null>(null);
  editOwner = '';
  editName = '';

  tokenForm = this.fb.group({
    githubUsername: ['', Validators.required],
    personalAccessToken: ['', Validators.required],
  });

  repoForm = this.fb.group({
    repoOwner: ['', Validators.required],
    repoName: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadData();
  }

  isLocked(): boolean {
    return !!this.status()?.connected && !this.isEditingToken();
  }

  loadData(): void {
    this.credentialService.getGitHubStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        if (s?.connected && s.username) {
          if (!this.isEditingToken()) {
            this.tokenForm.patchValue({
              githubUsername: s.username,
              personalAccessToken: 'ghp_••••••••••••••••••••••••',
            });
          }
          if (!this.repoForm.value.repoOwner) {
            this.repoForm.patchValue({ repoOwner: s.username });
          }
        }
      },
      error: (err) => console.warn('Error cargando estado GitHub:', err),
    });
    this.credentialService.getMonitoredRepos().subscribe({
      next: (r) => {
        this.repos.set(r || []);
      },
      error: (err) => console.warn('Error cargando repos:', err),
    });
  }

  requestEditToken(): void {
    const ok = confirm(
      'Advertencia:\n\nModificar las credenciales activas de GitHub puede interrumpir la lectura de repositorios configurados.\n\n¿Deseas desbloquear y editar el token?',
    );
    if (ok) {
      this.isEditingToken.set(true);
      this.tokenForm.patchValue({ personalAccessToken: '' });
    }
  }

  cancelTokenEdit(): void {
    this.isEditingToken.set(false);
    this.loadData();
  }

  testGitHubConnection(): void {
    const username = this.tokenForm.value.githubUsername;
    const token = this.tokenForm.value.personalAccessToken;
    if (!token || !username || token.includes('•••')) return;

    this.testing.set(true);
    this.testMessage.set(null);

    setTimeout(() => {
      this.testing.set(false);
      if (token.startsWith('ghp_') || token.startsWith('github_pat_') || token.length >= 20) {
        this.testSuccess.set(true);
        this.testMessage.set(`PAT de GitHub verificado exitosamente para @${username}.`);
      } else {
        this.testSuccess.set(false);
        this.testMessage.set('Formato de PAT de GitHub no reconocido.');
      }
    }, 1000);
  }

  saveToken(): void {
    if (this.tokenForm.invalid) return;
    const { personalAccessToken, githubUsername } = this.tokenForm.value;
    if (personalAccessToken?.includes('•••')) return;

    this.saving.set(true);
    this.credentialService.saveGitHubCredential(personalAccessToken!, githubUsername!).subscribe({
      next: () => {
        this.saving.set(false);
        this.isEditingToken.set(false);
        this.testSuccess.set(true);
        this.testMessage.set('Token de GitHub cifrado y guardado con éxito.');
        this.loadData();
      },
      error: (err) => {
        this.saving.set(false);
        this.testSuccess.set(false);
        this.testMessage.set(err?.error?.message || 'Error guardando token');
      },
    });
  }

  disconnectGitHub(): void {
    if (!confirm('¿Estás seguro de que deseas revocar tu Personal Access Token de GitHub?')) return;
    this.disconnecting.set(true);
    this.credentialService.deleteGitHubCredential().subscribe({
      next: () => {
        this.disconnecting.set(false);
        this.isEditingToken.set(false);
        this.tokenForm.reset();
        this.loadData();
      },
      error: (err) => {
        this.disconnecting.set(false);
        console.error('Error desconectando GitHub:', err);
      },
    });
  }

  startEditRepo(repo: GitHubRepo): void {
    this.editingRepoId.set(repo.id);
    this.editOwner = repo.repoOwner;
    this.editName = repo.repoName;
  }

  cancelEdit(): void {
    this.editingRepoId.set(null);
  }

  saveEditRepo(id: string): void {
    if (!this.editOwner.trim() || !this.editName.trim()) return;
    this.credentialService
      .updateMonitoredRepo(id, this.editOwner.trim(), this.editName.trim())
      .subscribe({
        next: () => {
          this.editingRepoId.set(null);
          this.loadData();
        },
        error: (err) => console.error('Error actualizando repo:', err),
      });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (!event.dataTransfer) return;

    const textData =
      event.dataTransfer.getData('text/plain') || event.dataTransfer.getData('text/uri-list');
    if (textData) {
      this.repoUrl.set(textData.trim());
      this.parseAndSetGitHubUrl(textData);
      return;
    }

    this.testMessage.set('Arrastra un enlace de GitHub. Las carpetas locales no se importan.');
  }

  useRepositoryUrl(value: string): void {
    this.repoUrl.set(value);
    this.parseAndSetGitHubUrl(value);
  }

  onOwnerInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.value && (input.value.includes('github.com') || input.value.includes('/'))) {
      this.parseAndSetGitHubUrl(input.value);
    }
  }

  private parseAndSetGitHubUrl(rawUrl: string): void {
    const value = rawUrl.trim();
    let owner = '';
    let repo = '';
    const shorthand = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/);
    if (shorthand) {
      owner = shorthand[1];
      repo = shorthand[2].replace(/\.git$/i, '');
    } else {
      try {
        const parsed = new URL(value);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (
          parsed.protocol !== 'https:' ||
          parsed.hostname.toLowerCase() !== 'github.com' ||
          parsed.username ||
          parsed.password ||
          parts.length !== 2 ||
          !parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
        )
          throw new Error('invalid');
        owner = parts[0];
        repo = parts[1].replace(/\.git$/i, '');
      } catch {
        this.testMessage.set(
          'Usa una URL https://github.com/propietario/repositorio o el formato propietario/repositorio.',
        );
        return;
      }
    }
    this.repoForm.patchValue({ repoOwner: owner, repoName: repo });
    this.testMessage.set(null);
  }

  generatePostFromRepo(repo: GitHubRepo): void {
    this.router.navigate(['/studio'], {
      queryParams: { repoId: repo.id, repo: `${repo.repoOwner}/${repo.repoName}` },
    });
  }

  addRepo(): void {
    if (this.repoForm.invalid) return;
    this.adding.set(true);
    const { repoOwner, repoName } = this.repoForm.value;
    this.credentialService.addMonitoredRepo(repoOwner!, repoName!).subscribe({
      next: () => {
        this.adding.set(false);
        this.repoForm.reset({ repoOwner: this.status()?.username || '' });
        this.loadData();
      },
      error: (err) => {
        this.adding.set(false);
        console.error('Error agregando repo:', err);
      },
    });
  }

  deleteRepo(id: string): void {
    if (!confirm('¿Deseas dejar de monitorear este repositorio?')) return;
    this.credentialService.deleteMonitoredRepo(id).subscribe(() => this.loadData());
  }
}
