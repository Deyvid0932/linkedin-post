import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CredentialService } from '../../../core/services/credential.service';
import {
  ConnectLinkedInAccountRequest,
  LinkedInAccount,
  LinkedInAccountType,
} from '../../../core/models/credential.model';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-linkedin-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe, NgClass],
  templateUrl: './linkedin-settings.component.html',
})
export class LinkedinSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private credentialService = inject(CredentialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  accounts = signal<LinkedInAccount[]>([]);
  loading = signal(false);
  saving = signal(false);
  actionLoading = signal<string | null>(null);
  connectingOAuth = signal(false);

  showConnectModal = signal(false);
  showEditWarningModal = signal(false);
  selectedType = signal<LinkedInAccountType>('PERSON');
  useExistingToken = signal(false);
  showToken = signal(false);

  editingAccountId = signal<string | null>(null);
  accountToEdit = signal<LinkedInAccount | null>(null);

  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  personAccounts = computed(() => this.accounts().filter((a) => a.accountType === 'PERSON'));

  accountForm = this.fb.group({
    accessToken: ['', [Validators.minLength(20)]],
    displayName: [''],
    authorUrn: [''],
    maxPostsPerDay: [1, [Validators.min(1), Validators.max(10)]],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const result = params.get('linkedin_oauth');
      if (!result) return;
      if (result === 'connected') {
        this.successMessage.set('Perfil de LinkedIn conectado.');
        this.loadAccounts();
      } else if (result === 'cancelled')
        this.errorMessage.set(
          'Cancelaste la autorización de LinkedIn. Puedes intentarlo cuando quieras.',
        );
      else
        this.errorMessage.set(
          'No se pudo completar la conexión. Revisa los permisos de LinkedIn y vuelve a intentarlo.',
        );
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { linkedin_oauth: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
    this.loadAccounts();
  }

  connectWithLinkedIn(): void {
    if (this.connectingOAuth()) return;
    this.connectingOAuth.set(true);
    this.errorMessage.set(null);
    this.credentialService.startLinkedInOAuth().subscribe({
      next: ({ authorizationUrl }) => {
        if (!authorizationUrl.startsWith('https://www.linkedin.com/oauth/v2/authorization?')) {
          this.connectingOAuth.set(false);
          this.errorMessage.set('LinkedIn devolvió una dirección de autorización no válida.');
          return;
        }
        window.location.assign(authorizationUrl);
      },
      error: (err) => {
        this.connectingOAuth.set(false);
        this.errorMessage.set(
          err?.error?.message ||
            'No pudimos iniciar la conexión. Revisa la configuración de LinkedIn.',
        );
      },
    });
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.credentialService.getLinkedInAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Error cargando cuentas de LinkedIn:', err);
        this.loading.set(false);
      },
    });
  }

  calcPercentage(days: number): number {
    return Math.round(Math.min(100, Math.max(0, (days / 60) * 100)));
  }

  openConnectModal(): void {
    this.editingAccountId.set(null);
    this.accountToEdit.set(null);
    this.selectedType.set('PERSON');
    this.useExistingToken.set(false);
    this.accountForm.reset();
    this.showConnectModal.set(true);
  }

  closeConnectModal(): void {
    this.showConnectModal.set(false);
    this.editingAccountId.set(null);
    this.accountToEdit.set(null);
  }

  requestEditAccount(acc: LinkedInAccount): void {
    this.accountToEdit.set(acc);
    this.showEditWarningModal.set(true);
  }

  confirmUnlockToken(): void {
    const acc = this.accountToEdit();
    this.showEditWarningModal.set(false);
    if (!acc) return;

    this.editingAccountId.set(acc.id);
    this.selectedType.set(acc.accountType);
    this.accountForm.patchValue({
      displayName: acc.displayName,
      authorUrn: acc.authorUrn,
      accessToken: '',
    });
    this.showConnectModal.set(true);
  }

  toggleAccount(acc: LinkedInAccount): void {
    this.actionLoading.set(acc.id);
    this.credentialService.toggleLinkedInAccount(acc.id).subscribe({
      next: (updated) => {
        this.accounts.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.actionLoading.set(null);
        this.successMessage.set(
          `Cuenta '${acc.displayName}' ${updated.isEnabled ? 'activada' : 'pausada'} para publicaciones.`,
        );
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al cambiar estado de la cuenta.');
      },
    });
  }

  setAsPrimary(acc: LinkedInAccount): void {
    this.actionLoading.set(acc.id);
    this.credentialService.setPrimaryLinkedInAccount(acc.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.successMessage.set(
          `'${acc.displayName}' establecida como cuenta principal de publicación.`,
        );
        this.loadAccounts();
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al establecer cuenta principal.');
      },
    });
  }

  disconnectAccount(acc: LinkedInAccount): void {
    if (
      !confirm(`¿Estás seguro de que deseas revocar y desconectar la cuenta '${acc.displayName}'?`)
    )
      return;

    this.actionLoading.set(acc.id);
    this.credentialService.deleteLinkedInAccount(acc.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.successMessage.set(`Cuenta '${acc.displayName}' desconectada exitosamente.`);
        this.loadAccounts();
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error desconectando la cuenta.');
      },
    });
  }

  submitAccount(): void {
    const val = this.accountForm.value;
    const isOrg = this.selectedType() === 'ORGANIZATION';

    let authorUrn = val.authorUrn?.trim();
    if (isOrg && authorUrn && !authorUrn.startsWith('urn:li:organization:')) {
      authorUrn = 'urn:li:organization:' + authorUrn;
    }

    const payload: ConnectLinkedInAccountRequest = {
      accountType: this.selectedType(),
      expiresInDays: 60,
      maxPostsPerDay: val.maxPostsPerDay || 1,
    };

    if (this.useExistingToken() && this.personAccounts().length > 0) {
      payload.useExistingTokenFromAccountId = this.personAccounts()[0].id;
    } else {
      payload.accessToken = val.accessToken?.trim() || undefined;
    }

    if (isOrg) {
      payload.displayName = val.displayName?.trim() || 'Página de Organización';
      payload.authorUrn = authorUrn;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.credentialService.connectLinkedInAccount(payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeConnectModal();
        this.successMessage.set(
          `Cuenta '${created.displayName}' vinculada y cifrada exitosamente.`,
        );
        this.loadAccounts();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al conectar la cuenta de LinkedIn.');
      },
    });
  }

  adjustLimit(acc: LinkedInAccount, delta: number): void {
    const current = acc.maxPostsPerDay || 1;
    const nextVal = Math.min(10, Math.max(1, current + delta));
    if (nextVal === current) return;

    this.actionLoading.set(acc.id);
    this.credentialService.updateAccountLimit(acc.id, nextVal).subscribe({
      next: (updated) => {
        this.accounts.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.actionLoading.set(null);
        this.successMessage.set(
          `Límite diario de '${acc.displayName}' actualizado a ${updated.maxPostsPerDay} post(s)/día.`,
        );
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al actualizar límite diario.');
      },
    });
  }
}
