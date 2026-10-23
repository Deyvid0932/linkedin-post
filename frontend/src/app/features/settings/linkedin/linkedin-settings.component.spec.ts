import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CredentialService } from '../../../core/services/credential.service';
import { LinkedInAccount } from '../../../core/models/credential.model';
import { LinkedinSettingsComponent } from './linkedin-settings.component';

describe('LinkedinSettingsComponent', () => {
  let fixture: ComponentFixture<LinkedinSettingsComponent>;
  let component: LinkedinSettingsComponent;
  let credentials: { getLinkedInAccounts: ReturnType<typeof vi.fn>; deleteLinkedInAccount: ReturnType<typeof vi.fn>; startLinkedInOAuth: ReturnType<typeof vi.fn> };

  const connectedAccount: LinkedInAccount = {
    id: 'account-1',
    accountType: 'PERSON',
    authorUrn: 'urn:li:person:123',
    displayName: 'Deyvid',
    maxPostsPerDay: 3,
    isEnabled: true,
    isPrimary: true,
    isValid: true,
    daysRemaining: 30,
    status: 'ACTIVE',
    createdAt: '2026-10-01T00:00:00Z',
  };

  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable:true, value:function(this: HTMLDialogElement) { this.setAttribute('open',''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable:true, value:function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
    credentials = { getLinkedInAccounts: vi.fn(() => of([])), deleteLinkedInAccount: vi.fn(() => of({})), startLinkedInOAuth: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LinkedinSettingsComponent],
      providers: [
        { provide: CredentialService, useValue: credentials },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({})) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(LinkedinSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the company page form from the empty state', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const addCompanyLink = Array.from(buttons).find((button) =>
      button.textContent?.trim() === 'Añadir página de empresa',
    );

    expect(addCompanyLink).toBeDefined();
    addCompanyLink?.click();
    fixture.detectChanges();

    expect(component.selectedType()).toBe('ORGANIZATION');
    expect(component.showConnectModal()).toBe(true);
  });

  it('keeps the company page action available when a personal account is connected', () => {
    component.accounts.set([connectedAccount]);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    const addCompanyButton = Array.from(buttons).find(
      (button) => button.textContent?.trim() === 'Añadir página de empresa',
    );

    expect(addCompanyButton).toBeDefined();
    addCompanyButton?.click();
    fixture.detectChanges();

    expect(component.selectedType()).toBe('ORGANIZATION');
    expect(component.showConnectModal()).toBe(true);
  });

  it('explains the real requirements without promising real-time publication', () => {
    const pageText = fixture.nativeElement.textContent as string;

    expect(pageText).toContain('La programación requiere el backend activo');
    expect(pageText).toContain('token con permisos de publicación');
    expect(pageText).toContain('AutoPost no recibe tu contraseña');
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Conectar Instagram');
    expect(pageText).not.toContain('en tiempo real');
  });

  it('keeps known accounts visible and offers retry when account refresh fails', () => {
    component.accounts.set([connectedAccount]);
    credentials.getLinkedInAccounts.mockReturnValueOnce(throwError(() => new Error('offline')));

    component.loadAccounts();
    fixture.detectChanges();

    expect(component.accountsLoadError()).toContain('No se pudo consultar el estado de LinkedIn');
    expect(fixture.nativeElement.textContent).toContain('Deyvid');
    expect(fixture.nativeElement.textContent).not.toContain('Sin cuentas de LinkedIn vinculadas');

    credentials.getLinkedInAccounts.mockReturnValueOnce(of([connectedAccount]));
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const retry = Array.from(buttons).find((button) => button.textContent?.trim() === 'Reintentar');
    retry?.click();
    fixture.detectChanges();

    expect(component.accountsLoadError()).toBe('');
    expect(component.accounts()).toEqual([connectedAccount]);
  });

  it('requires confirmation before disconnecting and keeps the dialog open after failure', () => {
    component.accounts.set([connectedAccount]);
    component.disconnectAccount(connectedAccount);
    expect(credentials.deleteLinkedInAccount).not.toHaveBeenCalled();
    credentials.deleteLinkedInAccount.mockReturnValueOnce(throwError(() => ({error:{message:'Sin conexión'}})));
    component.confirmDisconnect();
    expect(component.accountToDisconnect()?.id).toBe(connectedAccount.id);
    expect(component.errorMessage()).toBe('Sin conexión');
    component.confirmDisconnect();
    expect(component.accountToDisconnect()).toBeNull();
  });

  it('shows a customer-facing OAuth setup error without exposing server variable names', () => {
    credentials.startLinkedInOAuth.mockReturnValueOnce(throwError(() => ({status:424,error:{message:'Configura LINKEDIN_CLIENT_SECRET'}})));
    component.connectWithLinkedIn();
    expect(component.errorMessage()).toContain('Contacta al administrador');
    expect(component.errorMessage()).not.toContain('CLIENT_SECRET');
    expect(component.connectingOAuth()).toBe(false);
  });

  it('does not invent a valid expiry date or display fractional remaining days', () => {
    expect(component.expirationLabel({...connectedAccount, daysRemaining:15.9,tokenExpiresAt:'not-a-date'})).toBe('15 días restantes');
    expect(component.expirationLabel({...connectedAccount,isValid:false})).toContain('renovarse');
  });
});
