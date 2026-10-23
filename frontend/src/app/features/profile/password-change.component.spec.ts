import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PasswordChangeComponent } from './password-change.component';

describe('PasswordChangeComponent', () => {
  const auth = { updateProfile: vi.fn(), logout: vi.fn() };
  beforeEach(() => {
    auth.updateProfile.mockReset().mockReturnValue(of({})); auth.logout.mockReset();
    TestBed.configureTestingModule({ imports:[PasswordChangeComponent], providers:[{provide:AuthService,useValue:auth}] });
  });
  it('requires the current password and matching confirmation', () => {
    const component = TestBed.createComponent(PasswordChangeComponent).componentInstance;
    component.form.patchValue({ newPassword:'newpass',confirmPassword:'different' }); component.save();
    expect(component.error()).toContain('contraseña actual');
    component.form.controls.currentPassword.setValue('oldpass'); component.save();
    expect(component.error()).toContain('no coinciden');
    expect(auth.updateProfile).not.toHaveBeenCalled();
  });
  it('keeps values for retry after rejection and logs out only after a successful change', () => {
    const component = TestBed.createComponent(PasswordChangeComponent).componentInstance;
    component.form.setValue({currentPassword:'oldpass',newPassword:'newpass',confirmPassword:'newpass'});
    auth.updateProfile.mockReturnValueOnce(throwError(() => ({error:{message:'Contraseña incorrecta'}})));
    component.save();
    expect(component.error()).toBe('Contraseña incorrecta'); expect(component.form.controls.newPassword.value).toBe('newpass');
    expect(auth.logout).not.toHaveBeenCalled();
    component.save();
    expect(auth.updateProfile).toHaveBeenLastCalledWith(undefined,'oldpass','newpass');
    expect(auth.logout).toHaveBeenCalledWith({passwordUpdated:'true'});
  });
});
