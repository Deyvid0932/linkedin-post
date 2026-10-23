import { Component, DestroyRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subject, catchError, debounceTime, finalize, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AccountInvitation, AccountInvitationPage, AdminAuditPage, AdminService, AdminUser, AdminUserPage, ApiQuotaPolicy, ApiQuotaPolicyUpdate, CreatedAccountInvitation, PublicationApprovalPolicy, TenantAiQuota, TenantAiQuotaPage } from '../../core/services/admin.service';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { AdminOverviewComponent } from './admin-overview.component';

interface UserQuery { term: string; page: number; }
type AdminSection = 'overview' | 'users' | 'invitations' | 'quotas' | 'audit';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, DecimalPipe, DialogComponent, AdminOverviewComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly api = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userQuery = new Subject<UserQuery>();
  private readonly auditQuery = new Subject<number>();
  @ViewChild(AdminOverviewComponent) private overviewComponent?: AdminOverviewComponent;

  readonly users = signal<AdminUserPage | null>(null);
  readonly invitations = signal<AccountInvitationPage | null>(null);
  readonly createdInvitation = signal<CreatedAccountInvitation | null>(null);
  readonly invitationEmail = signal('');
  readonly invitationError = signal('');
  readonly invitationSuccess = signal('');
  readonly loadingInvitations = signal(false);
  readonly savingInvitation = signal(false);
  readonly revokingInvitation = signal<string | null>(null);
  readonly invitationCopied = signal(false);
  readonly auditEvents = signal<AdminAuditPage | null>(null);
  readonly search = signal('');
  readonly loadingUsers = signal(false);
  readonly usersError = signal('');
  readonly auditError = signal('');
  readonly loadingAudit = signal(false);
  readonly pendingStatus = signal<{ user: AdminUser; active: boolean } | null>(null);
  readonly savingStatus = signal(false);
  readonly statusError = signal('');
  readonly pendingRoles = signal<{ user: AdminUser; roles: Set<string> } | null>(null);
  readonly savingRoles = signal(false);
  readonly rolesError = signal('');
  readonly rolesSuccess = signal('');
  readonly quotaPolicy = signal<ApiQuotaPolicy | null>(null);
  readonly quotaForm = signal<ApiQuotaPolicyUpdate>({ authRequestsPerMinute: 20, aiRequestsPerMinute: 10, apiRequestsPerMinute: 120 });
  readonly loadingQuotas = signal(false);
  readonly savingQuotas = signal(false);
  readonly quotaError = signal('');
  readonly quotaSuccess = signal('');
  readonly publicationApprovalPolicy = signal<PublicationApprovalPolicy | null>(null);
  readonly loadingPublicationPolicy = signal(false);
  readonly savingPublicationPolicy = signal(false);
  readonly publicationPolicyError = signal('');
  readonly publicationPolicySuccess = signal('');
  readonly tenantAiQuotas = signal<TenantAiQuotaPage | null>(null);
  readonly loadingTenantAiQuotas = signal(false);
  readonly tenantAiQuotaError = signal('');
  readonly savingTenantAiQuota = signal<string | null>(null);
  readonly tenantAiQuotaDrafts = signal<Record<string, string>>({});
  readonly tenantAiQuotaExpiryDrafts = signal<Record<string, string>>({});
  readonly userAiQuotaDrafts = signal<Record<string, string>>({});
  readonly userAiQuotaExpiryDrafts = signal<Record<string, string>>({});
  readonly savingUserAiQuota = signal<string | null>(null);
  readonly userAiQuotaError = signal('');
  readonly userAiQuotaSuccess = signal('');
  readonly activeSection = signal<AdminSection>('overview');

  ngOnInit(): void {
    this.auditQuery.pipe(
      switchMap((page) => {
        this.loadingAudit.set(true);
        this.auditError.set('');
        return this.api.getAuditEvents(page).pipe(
          catchError((error: { error?: { message?: string } }) => {
            this.auditError.set(error.error?.message || 'No se pudo cargar la auditoría.');
            return of(null);
          }),
          finalize(() => this.loadingAudit.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (page) this.auditEvents.set(page);
    });
    this.userQuery.pipe(
      debounceTime(200),
      switchMap((query) => {
        this.loadingUsers.set(true);
        this.usersError.set('');
        return this.api.getUsers(query.term, query.page).pipe(
          catchError((error: { error?: { message?: string } }) => {
            this.usersError.set(error.error?.message || 'No se pudo cargar la lista de cuentas.');
            return of(null);
          }),
          tap(() => this.loadingUsers.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((page) => {
      if (page) this.users.set(page);
    });
  }

  selectSection(section: AdminSection): void {
    this.activeSection.set(section);
    if (section === 'users' && !this.users() && !this.loadingUsers()) this.loadUsers(0);
    if (section === 'invitations' && !this.invitations() && !this.loadingInvitations()) this.loadInvitations(0);
    if (section === 'quotas') {
      if (!this.quotaPolicy() && !this.loadingQuotas()) this.loadQuotaPolicy();
      if (!this.publicationApprovalPolicy() && !this.loadingPublicationPolicy()) this.loadPublicationPolicy();
      if (!this.tenantAiQuotas() && !this.loadingTenantAiQuotas()) this.loadTenantAiQuotas(0);
    }
    if (section === 'audit' && !this.auditEvents() && !this.loadingAudit()) this.loadAudit(0);
  }

  refreshCurrentSection(): void {
    switch (this.activeSection()) {
      case 'overview': this.overviewComponent?.load(); break;
      case 'users': this.loadUsers(this.users()?.number ?? 0); break;
      case 'invitations': this.loadInvitations(this.invitations()?.number ?? 0); break;
      case 'quotas': this.loadQuotaPolicy(); this.loadPublicationPolicy(); this.loadTenantAiQuotas(this.tenantAiQuotas()?.number ?? 0); break;
      case 'audit': this.loadAudit(); break;
    }
  }

  isCurrentSectionLoading(): boolean {
    switch (this.activeSection()) {
      case 'overview': return this.overviewComponent?.loading() ?? false;
      case 'users': return this.loadingUsers();
      case 'invitations': return this.loadingInvitations() || this.savingInvitation();
      case 'quotas': return this.loadingQuotas() || this.loadingTenantAiQuotas() || this.loadingPublicationPolicy();
      case 'audit': return this.loadingAudit();
    }
  }

  loadQuotaPolicy(): void {
    this.loadingQuotas.set(true);
    this.quotaError.set('');
    this.api.getApiQuotaPolicy().pipe(finalize(() => this.loadingQuotas.set(false))).subscribe({
      next: (policy) => {
        this.quotaPolicy.set(policy);
        this.quotaForm.set({
          authRequestsPerMinute: policy.authRequestsPerMinute,
          aiRequestsPerMinute: policy.aiRequestsPerMinute,
          apiRequestsPerMinute: policy.apiRequestsPerMinute,
        });
      },
      error: (error: { error?: { message?: string } }) => {
        this.quotaError.set(error.error?.message || 'No se pudo cargar la política de límites.');
      },
    });
  }

  setQuota(field: keyof ApiQuotaPolicyUpdate, value: string): void {
    this.quotaForm.update((current) => ({ ...current, [field]: Number(value) }));
    this.quotaSuccess.set('');
  }

  saveQuotaPolicy(): void {
    if (this.savingQuotas()) return;
    const policy = this.quotaForm();
    this.savingQuotas.set(true);
    this.quotaError.set('');
    this.quotaSuccess.set('');
    this.api.updateApiQuotaPolicy(policy).pipe(finalize(() => this.savingQuotas.set(false))).subscribe({
      next: (saved) => {
        this.quotaPolicy.set(saved);
        this.quotaSuccess.set('Límites guardados y aplicados a las instancias conectadas a esta base.');
      },
      error: (error: { error?: { message?: string } }) => {
        this.quotaError.set(error.error?.message || 'No se pudieron guardar los límites.');
      },
    });
  }

  loadPublicationPolicy(): void {
    this.loadingPublicationPolicy.set(true);
    this.publicationPolicyError.set('');
    this.api.getPublicationApprovalPolicy().pipe(finalize(() => this.loadingPublicationPolicy.set(false))).subscribe({
      next: (policy) => this.publicationApprovalPolicy.set(policy),
      error: (error: { error?: { message?: string } }) => {
        this.publicationPolicyError.set(error.error?.message || 'No se pudo cargar la política global de aprobación.');
      },
    });
  }

  togglePublicationApprovalPolicy(): void {
    const current = this.publicationApprovalPolicy();
    if (!current || this.savingPublicationPolicy()) return;
    this.savingPublicationPolicy.set(true);
    this.publicationPolicyError.set('');
    this.publicationPolicySuccess.set('');
    this.api.updatePublicationApprovalPolicy(!current.approvalRequired)
      .pipe(finalize(() => this.savingPublicationPolicy.set(false)))
      .subscribe({
        next: (saved) => {
          this.publicationApprovalPolicy.set(saved);
          this.publicationPolicySuccess.set(saved.approvalRequired
            ? 'La aprobación quedó exigida para las publicaciones automáticas de todos los espacios.'
            : 'La aprobación global es opcional; cada espacio puede elegir su modo.');
          this.loadAudit();
        },
        error: (error: { error?: { message?: string } }) => {
          this.publicationPolicyError.set(error.error?.message || 'No se pudo actualizar la política global de aprobación.');
        },
      });
  }

  loadTenantAiQuotas(page: number): void {
    this.loadingTenantAiQuotas.set(true);
    this.tenantAiQuotaError.set('');
    this.api.getTenantAiQuotas(Math.max(0, page)).pipe(finalize(() => this.loadingTenantAiQuotas.set(false))).subscribe({
      next: (result) => this.tenantAiQuotas.set(result),
      error: (error: { error?: { message?: string } }) => {
        this.tenantAiQuotaError.set(error.error?.message || 'No se pudieron cargar los límites por espacio.');
      },
    });
  }

  setTenantAiQuotaDraft(tenantId: string, value: string): void {
    this.tenantAiQuotaDrafts.update((drafts) => ({ ...drafts, [tenantId]: value }));
    this.tenantAiQuotaError.set('');
    this.quotaSuccess.set('');
  }

  setTenantAiQuotaExpiryDraft(tenantId: string, value: string): void {
    this.tenantAiQuotaExpiryDrafts.update((drafts) => ({ ...drafts, [tenantId]: value }));
    this.tenantAiQuotaError.set('');
  }

  tenantQuotaExpiryValue(row: TenantAiQuota): string {
    const drafts = this.tenantAiQuotaExpiryDrafts();
    return Object.hasOwn(drafts, row.tenantId) ? drafts[row.tenantId] : this.toDateTimeLocal(row.overrideExpiresAt);
  }

  saveTenantAiQuota(row: TenantAiQuota): void {
    if (this.savingTenantAiQuota()) return;
    const draft = this.tenantAiQuotaDrafts()[row.tenantId];
    const value = draft === undefined ? row.overrideRequestsPerMinute : draft.trim() === '' ? null : Number(draft);
    const expiryDrafts = this.tenantAiQuotaExpiryDrafts();
    const expiryDraft = Object.hasOwn(expiryDrafts, row.tenantId) ? expiryDrafts[row.tenantId] : undefined;
    const expiresAt = value === null ? null : expiryDraft === undefined ? row.overrideExpiresAt : this.toInstant(expiryDraft);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 120)) {
      this.tenantAiQuotaError.set('El límite debe ser un número entero entre 1 y 120, o vacío para heredar el valor global.');
      return;
    }
    this.tenantAiQuotaError.set('');
    if (expiryDraft?.trim() && (!Number.isFinite(Date.parse(expiryDraft)) || Date.parse(expiryDraft) <= Date.now())
        || expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
      this.tenantAiQuotaError.set('La fecha de vencimiento debe estar en el futuro.');
      return;
    }
    this.savingTenantAiQuota.set(row.tenantId);
    this.api.updateTenantAiQuota(row.tenantId, value, value === null ? null : expiresAt).pipe(finalize(() => this.savingTenantAiQuota.set(null))).subscribe({
      next: (saved) => {
        this.tenantAiQuotas.update((page) => page ? {
          ...page,
          content: page.content.map((item) => item.tenantId === saved.tenantId ? saved : item),
        } : page);
        this.tenantAiQuotaDrafts.update((drafts) => {
          const next = { ...drafts };
          delete next[row.tenantId];
          return next;
        });
        this.tenantAiQuotaExpiryDrafts.update((drafts) => {
          const next = { ...drafts };
          delete next[row.tenantId];
          return next;
        });
        this.quotaSuccess.set(saved.overrideRequestsPerMinute === null
          ? 'El espacio ahora hereda el límite global de IA.'
          : 'Límite de IA del espacio guardado.');
      },
      error: (error: { error?: { message?: string } }) => {
        this.tenantAiQuotaError.set(error.error?.message || 'No se pudo guardar el límite de este espacio.');
      },
    });
  }

  setUserAiQuotaDraft(userId: string, value: string): void {
    this.userAiQuotaDrafts.update((drafts) => ({ ...drafts, [userId]: value }));
    this.userAiQuotaError.set('');
    this.userAiQuotaSuccess.set('');
  }

  setUserAiQuotaExpiryDraft(userId: string, value: string): void {
    this.userAiQuotaExpiryDrafts.update((drafts) => ({ ...drafts, [userId]: value }));
    this.userAiQuotaError.set('');
  }

  userQuotaExpiryValue(user: AdminUser): string {
    const drafts = this.userAiQuotaExpiryDrafts();
    return Object.hasOwn(drafts, user.id) ? drafts[user.id] : this.toDateTimeLocal(user.aiRequestsPerMinuteExpiresAt);
  }

  quotaExpiryLabel(value: string | null): string {
    if (!value) return 'Sin vencimiento';
    const date = new Date(value);
    return date.getTime() <= Date.now()
      ? 'Vencido'
      : `Vence ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(date)}`;
  }

  minQuotaExpiry(): string {
    return this.toDateTimeLocal(new Date(Date.now() + 120_000).toISOString());
  }

  saveUserAiQuota(user: AdminUser): void {
    if (this.savingUserAiQuota()) return;
    const draft = this.userAiQuotaDrafts()[user.id];
    const value = draft === undefined ? user.aiRequestsPerMinute : draft.trim() === '' ? null : Number(draft);
    const expiryDrafts = this.userAiQuotaExpiryDrafts();
    const expiryDraft = Object.hasOwn(expiryDrafts, user.id) ? expiryDrafts[user.id] : undefined;
    const expiresAt = value === null ? null : expiryDraft === undefined ? user.aiRequestsPerMinuteExpiresAt : this.toInstant(expiryDraft);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 120)) {
      this.userAiQuotaError.set('El límite debe ser un entero entre 1 y 120, o vacío para heredar el límite del espacio.');
      return;
    }
    if (expiryDraft?.trim() && (!Number.isFinite(Date.parse(expiryDraft)) || Date.parse(expiryDraft) <= Date.now())
        || expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
      this.userAiQuotaError.set('La fecha de vencimiento debe estar en el futuro.');
      return;
    }
    this.savingUserAiQuota.set(user.id);
    this.userAiQuotaError.set('');
    this.userAiQuotaSuccess.set('');
    this.api.updateUserAiQuota(user.id, value, value === null ? null : expiresAt).pipe(finalize(() => this.savingUserAiQuota.set(null))).subscribe({
      next: (saved) => {
        this.users.update((page) => page ? {
          ...page,
          content: page.content.map((item) => item.id === saved.id ? saved : item),
        } : page);
        this.userAiQuotaDrafts.update((drafts) => {
          const next = { ...drafts };
          delete next[user.id];
          return next;
        });
        this.userAiQuotaExpiryDrafts.update((drafts) => {
          const next = { ...drafts };
          delete next[user.id];
          return next;
        });
        this.userAiQuotaSuccess.set(saved.aiRequestsPerMinute === null
          ? 'La cuenta ahora hereda el límite de IA de su espacio.'
          : 'Límite personal de IA guardado.');
        this.loadAudit();
      },
      error: (error: { error?: { message?: string } }) => {
        this.userAiQuotaError.set(error.error?.message || 'No se pudo guardar el límite personal de IA.');
      },
    });
  }

  private toDateTimeLocal(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  private toInstant(value: string): string | null {
    if (!value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.loadUsers(0);
  }

  loadUsers(page: number): void {
    this.userQuery.next({ term: this.search().trim(), page });
  }

  loadInvitations(page = 0): void {
    this.loadingInvitations.set(true);
    this.invitationError.set('');
    this.api.getInvitations(Math.max(0, page)).pipe(
      finalize(() => this.loadingInvitations.set(false)),
    ).subscribe({
      next: (result) => this.invitations.set(result),
      error: (error: { error?: { message?: string } }) => {
        this.invitationError.set(error.error?.message || 'No se pudieron cargar las invitaciones.');
      },
    });
  }

  setInvitationEmail(email: string): void {
    this.invitationEmail.set(email);
    this.invitationError.set('');
    this.invitationSuccess.set('');
  }

  createInvitation(): void {
    const email = this.invitationEmail().trim();
    if (!email || this.savingInvitation()) return;
    this.savingInvitation.set(true);
    this.invitationError.set('');
    this.invitationSuccess.set('');
    this.createdInvitation.set(null);
    this.invitationCopied.set(false);
    this.api.createInvitation(email).pipe(finalize(() => this.savingInvitation.set(false))).subscribe({
      next: (created) => {
        this.createdInvitation.set(created);
        this.invitationEmail.set('');
        this.invitationSuccess.set('Invitación creada. Copia el enlace y compártelo con la persona invitada.');
        this.loadInvitations(0);
      },
      error: (error: { error?: { message?: string } }) => {
        this.invitationError.set(error.error?.message || 'No se pudo crear la invitación.');
      },
    });
  }

  async copyInvitationLink(): Promise<void> {
    const url = this.createdInvitation()?.invitationUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.invitationCopied.set(true);
    } catch {
      this.invitationCopied.set(false);
      this.invitationError.set('No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.');
    }
  }

  revokeInvitation(invitation: AccountInvitation): void {
    if (invitation.status !== 'PENDING' || this.revokingInvitation()) return;
    this.invitationError.set('');
    this.revokingInvitation.set(invitation.id);
    this.api.revokeInvitation(invitation.id).pipe(finalize(() => this.revokingInvitation.set(null))).subscribe({
      next: () => {
        this.invitationSuccess.set('Invitación revocada. El enlace dejó de funcionar.');
        this.loadInvitations(this.invitations()?.number || 0);
      },
      error: (error: { error?: { message?: string } }) => {
        this.invitationError.set(error.error?.message || 'No se pudo revocar la invitación.');
      },
    });
  }

  invitationStatusLabel(status: AccountInvitation['status']): string {
    return ({ PENDING: 'Pendiente', EXPIRED: 'Vencida', ACCEPTED: 'Aceptada', REVOKED: 'Revocada' })[status];
  }

  loadAudit(page = this.auditEvents()?.number ?? 0): void {
    this.auditQuery.next(Math.max(0, page));
  }

  formatRole(role: string): string {
    return role.replace(/^ROLE_/, '');
  }

  requestStatusChange(user: AdminUser): void {
    this.statusError.set('');
    this.pendingStatus.set({ user, active: !user.active });
  }

  requestRoleChange(user: AdminUser): void {
    this.rolesError.set('');
    this.rolesSuccess.set('');
    this.pendingRoles.set({ user, roles: new Set(user.roles) });
  }

  toggleRole(role: string, selected: boolean): void {
    this.pendingRoles.update((pending) => {
      if (!pending) return pending;
      const roles = new Set(pending.roles);
      if (selected) roles.add(role);
      else roles.delete(role);
      return { ...pending, roles };
    });
    this.rolesError.set('');
  }

  confirmRoleChange(): void {
    const pending = this.pendingRoles();
    if (!pending || !pending.roles.size || this.savingRoles()) return;
    this.savingRoles.set(true);
    this.rolesError.set('');
    this.api.setUserRoles(pending.user.id, [...pending.roles]).pipe(
      catchError((error: { error?: { message?: string } }) => {
        this.rolesError.set(error.error?.message || 'No se pudieron actualizar los roles de la cuenta.');
        return of(null);
      }),
      tap(() => this.savingRoles.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((updated) => {
      if (!updated) return;
      this.pendingRoles.set(null);
      this.rolesSuccess.set('Permisos actualizados. La cuenta deberá iniciar sesión de nuevo.');
      this.loadUsers(this.users()?.number || 0);
      this.loadAudit();
    });
  }

  confirmStatusChange(): void {
    const pending = this.pendingStatus();
    if (!pending || this.savingStatus()) return;
    this.savingStatus.set(true);
    this.statusError.set('');
    this.api.setUserActive(pending.user.id, pending.active).pipe(
      catchError((error: { error?: { message?: string } }) => {
        this.statusError.set(error.error?.message || 'No se pudo actualizar el acceso de la cuenta.');
        return of(null);
      }),
      tap(() => this.savingStatus.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((updated) => {
      if (!updated) return;
      this.pendingStatus.set(null);
      this.overviewComponent?.load();
      this.loadUsers(this.users()?.number || 0);
      this.loadAudit();
    });
  }
}
