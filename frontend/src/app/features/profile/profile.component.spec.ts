import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';

describe('ProfileComponent', () => {
  const currentUserSignal = signal({
    userId: 'u1',
    tenantId: 't1',
    name: 'Deyvid Silva',
    email: 'deyvid@example.com',
    roles: ['USER'],
  });
  let component: ProfileComponent;
  let auth: {
    currentUserSignal: typeof currentUserSignal;
    updateProfile: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    currentUserSignal.set({
      userId: 'u1',
      tenantId: 't1',
      name: 'Deyvid Silva',
      email: 'deyvid@example.com',
      roles: ['USER'],
    });
    auth = {
      currentUserSignal,
      updateProfile: vi.fn(() => of({ name: 'Deyvid Nuevo' })),
      logout: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    component = TestBed.createComponent(ProfileComponent).componentInstance;
  });

  it('updates name and leaves the email read-only in the UI model', () => {
    component.form.controls.name.setValue('Deyvid Nuevo');
    component.save();
    expect(auth.updateProfile).toHaveBeenCalledWith('Deyvid Nuevo', '', '');
    expect(component.message()).toBe('Tu perfil se actualizó.');
  });

  it('requires current password and matching confirmation before password update', () => {
    component.form.patchValue({ newPassword: 'nueva123', confirmPassword: 'diferente' });
    component.save();
    expect(auth.updateProfile).not.toHaveBeenCalled();
    expect(component.error()).toContain('contraseña actual');
  });

  it('shows API failures without discarding the form values', () => {
    auth.updateProfile.mockReturnValue(
      throwError(() => ({ error: { message: 'Contraseña actual incorrecta' } })),
    );
    component.form.patchValue({
      name: 'Deyvid Nuevo',
      currentPassword: 'badpass',
      newPassword: 'newpass',
      confirmPassword: 'newpass',
    });
    component.save();
    expect(component.error()).toBe('Contraseña actual incorrecta');
    expect(component.form.controls.name.value).toBe('Deyvid Nuevo');
  });

  it('ends the old session after a password change and explains why on the login page', () => {
    component.form.patchValue({
      currentPassword: 'oldpass',
      newPassword: 'newpass',
      confirmPassword: 'newpass',
    });
    component.save();
    expect(auth.logout).toHaveBeenCalledWith({ passwordUpdated: 'true' });
  });
});
