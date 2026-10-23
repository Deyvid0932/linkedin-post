import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';

describe('ProfileComponent', () => {
  let auth: { currentUserSignal: ReturnType<typeof signal>; updateProfile: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    auth = {
      currentUserSignal: signal({ userId:'u1',tenantId:'t1',name:'Deyvid Silva',email:'deyvid@example.test',roles:['ROLE_USER'] }),
      updateProfile: vi.fn(() => of({ name:'Deyvid Nuevo' })),
    };
    TestBed.configureTestingModule({ imports:[ProfileComponent], providers:[provideRouter([]),{provide:AuthService,useValue:auth}] });
  });
  it('updates only the name and keeps email read-only', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.name.setValue('Deyvid Nuevo');
    component.save();
    expect(auth.updateProfile).toHaveBeenCalledWith('Deyvid Nuevo','','');
    expect(component.message()).toBe('Tu perfil se actualizó.');
    expect((fixture.nativeElement.querySelector('#profile-email') as HTMLInputElement).readOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/settings/security"]')).not.toBeNull();
  });
  it('rejects blank names and keeps the input after a server failure', () => {
    const component = TestBed.createComponent(ProfileComponent).componentInstance;
    component.form.controls.name.setValue('   ');
    component.save();
    expect(auth.updateProfile).not.toHaveBeenCalled();
    auth.updateProfile.mockReturnValue(throwError(() => ({ error:{message:'No disponible'} })));
    component.form.controls.name.setValue('Deyvid Nuevo');
    component.save();
    expect(component.error()).toBe('No disponible');
    expect(component.form.controls.name.value).toBe('Deyvid Nuevo');
  });
});
