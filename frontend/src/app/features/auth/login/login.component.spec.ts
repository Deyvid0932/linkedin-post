import { TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authServiceSpy: { login: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    authServiceSpy = {
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceSpy }],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with invalid empty form', () => {
    expect(component.form.valid).toBe(false);
    expect(component.form.get('email')?.valid).toBe(false);
    expect(component.form.get('password')?.valid).toBe(false);
  });

  it('should validate email format properly', () => {
    const emailCtrl = component.form.get('email');
    emailCtrl?.setValue('invalid-email');
    expect(emailCtrl?.valid).toBe(false);

    emailCtrl?.setValue('user@example.com');
    expect(emailCtrl?.valid).toBe(true);
  });

  it('should call authService.login and navigate to /dashboard on successful submit', () => {
    authServiceSpy.login.mockReturnValue(of({ token: 'test' }));

    component.form.setValue({
      email: 'user@example.com',
      password: 'Password123!',
    });

    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password123!',
    });
    expect(component.loading()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should set errorMessage when login fails', () => {
    authServiceSpy.login.mockReturnValue(
      throwError(() => ({ error: { message: 'Invalid credentials' } })),
    );

    component.form.setValue({
      email: 'user@example.com',
      password: 'WrongPassword',
    });

    component.onSubmit();

    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(component.loading()).toBe(false);
  });
});
