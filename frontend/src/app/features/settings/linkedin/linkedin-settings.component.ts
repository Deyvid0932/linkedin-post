import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CredentialService } from '../../../core/services/credential.service';
import {
  ConnectLinkedInAccountRequest,
  LinkedInAccount,
  LinkedInAccountType,
} from '../../../core/models/credential.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';

@Component({
  selector: 'app-linkedin-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, DialogComponent],
  templateUrl: './linkedin-settings.component.html',
  styleUrl: './linkedin-settings.component.css',
})
export class LinkedinSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private credentialService = inject(CredentialService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  accounts = signal<LinkedInAccount[]>([]);
  loading = signal(false);
  accountsLoadError = signal('');
  saving = signal(false);
  actionLoading = signal<string | null>(null);
  connectingOAuth = signal(false);
  readonly preferencesId = signal<string | null>(null);
  readonly preferencesAccount = computed(() => this.accounts().find(account => account.id === this.preferencesId()));
  readonly accountToDisconnect = signal<LinkedInAccount | null>(null);

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
    displayName: ['', [Validators.required, Validators.maxLength(120)]],
    authorUrn: ['', [Validators.required, Validators.pattern(/^(urn:li:organization:)?[0-9]+$/)]],
    maxPostsPerDay: [1, [Validators.min(1), Validators.max(10)]],
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
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
          (err?.status === 424 ? 'La conexión con LinkedIn aún no está disponible. Contacta al administrador.' : err?.error?.message) ||
            'No pudimos iniciar la conexión. Revisa la configuración de LinkedIn.',
        );
      },
    });
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.accountsLoadError.set('');
    this.credentialService.getLinkedInAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.accountsLoadError.set('No se pudo consultar el estado de LinkedIn. Reintenta para confirmar tus cuentas.');
      },
    });
  }

  accountInitials(name: string): string {
    return (name || 'Cuenta').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  expirationLabel(account: LinkedInAccount): string {
    if (!account.isValid || account.status === 'EXPIRED') return 'La autorización necesita renovarse.';
    const days = Number.isFinite(account.daysRemaining) ? Math.max(0, Math.floor(account.daysRemaining)) : null;
    let date = '';
    if(account.tokenExpiresAt && Number.isFinite(Date.parse(account.tokenExpiresAt))) {
      date = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(account.tokenExpiresAt));
    }
    return [days === null ? '' : days + ' días restantes', date ? 'Vence el ' + date : ''].filter(Boolean).join(' · ') || 'Sin fecha de vencimiento disponible';
  }

  openConnectModal(type: LinkedInAccountType = 'PERSON'): void {
    this.editingAccountId.set(null);
    this.accountToEdit.set(null);
    this.selectedType.set(type);
    this.useExistingToken.set(false);
    this.showToken.set(false);
    this.accountForm.reset({ maxPostsPerDay: 1 });
    this.showConnectModal.set(true);
  }

  closeConnectModal(): void {
    if (this.saving()) return;
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
      maxPostsPerDay: acc.maxPostsPerDay || 1,
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
    this.errorMessage.set(null);
    this.accountToDisconnect.set(acc);
  }

  cancelDisconnect(): void {
    if (!this.actionLoading()) this.accountToDisconnect.set(null);
  }

  confirmDisconnect(): void {
    const acc = this.accountToDisconnect();
    if (!acc || this.actionLoading()) return;
    this.actionLoading.set(acc.id);
    this.credentialService.deleteLinkedInAccount(acc.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.accountToDisconnect.set(null);
        if(this.preferencesId() === acc.id) this.preferencesId.set(null);
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
    if (this.saving()) return;
    this.accountForm.markAllAsTouched();
    if(this.accountForm.invalid || (!this.useExistingToken() && !this.accountForm.value.accessToken?.trim())) {
      this.errorMessage.set('Revisa el nombre, el identificador y la credencial antes de guardar.');
      return;
    }
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
