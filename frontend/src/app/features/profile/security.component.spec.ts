import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SecurityComponent } from './security.component';

describe('SecurityComponent', () => {
  const currentUserSignal = signal({
    userId: 'u1',
    tenantId: 't1',
    name: 'Deyvid Silva',
    email: 'deyvid@example.com',
    roles: ['ROLE_ADMIN'],
  });
  let component: SecurityComponent;
  let auth: {
    currentUserSignal: typeof currentUserSignal;
    logout: ReturnType<typeof vi.fn>;
    revokeSessions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      currentUserSignal,
      logout: vi.fn(),
      revokeSessions: vi.fn(() => of({ message: 'ok' })),
    };
    TestBed.configureTestingModule({
      imports: [SecurityComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    component = TestBed.createComponent(SecurityComponent).componentInstance;
  });

  it('requires the current password before requesting revocation', () => {
    component.requestRevoke();
    component.revokeSessions();
    expect(auth.revokeSessions).not.toHaveBeenCalled();
    expect(component.error()).toContain('contraseña actual');
  });

  it('revokes sessions and clears the local session after the server confirms', () => {
    component.requestRevoke();
    component.currentPassword.set('actual123');
    component.revokeSessions();
    expect(auth.revokeSessions).toHaveBeenCalledWith('actual123');
    expect(auth.logout).toHaveBeenCalledWith({ sessionsRevoked: 'true' });
  });

  it('keeps the form open and preserves input when the API rejects the password', () => {
    auth.revokeSessions.mockReturnValue(
      throwError(() => ({ error: { message: 'La contraseña actual es incorrecta' } })),
    );
    component.requestRevoke();
    component.currentPassword.set('incorrecta');
    component.revokeSessions();
    expect(component.confirmingRevoke()).toBe(true);
    expect(component.currentPassword()).toBe('incorrecta');
    expect(component.error()).toBe('La contraseña actual es incorrecta');
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('shows a readable role label for administrative access', () => {
    expect(component.roleLabel('ROLE_ADMIN')).toBe('Administrador');
  });
});
