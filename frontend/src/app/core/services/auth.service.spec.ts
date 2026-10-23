import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.model';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  const mockResponse: AuthResponse = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    name: 'Deyvi Test',
    email: 'test@example.com',
    roles: ['ROLE_USER'],
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('saas_auth_token', 'legacy-token');
    localStorage.setItem('saas_auth_user', '{"userId":"legacy-user"}');
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('starts unauthenticated and removes credentials saved by older versions', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUserSignal()).toBeNull();
    expect(localStorage.getItem('saas_auth_token')).toBeNull();
  });

  it('should login user and keep only the user profile in memory', () => {
    const loginReq: LoginRequest = { email: 'test@example.com', password: 'Password123!' };

    service.login(loginReq).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(loginReq);
    req.flush(mockResponse);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUserSignal()?.name).toBe('Deyvi Test');
    expect(localStorage.getItem('saas_auth_token')).toBeNull();
    expect(localStorage.getItem('saas_auth_user')).toBeNull();
  });

  it('should register user and set the authenticated state in memory', () => {
    const registerReq: RegisterRequest = {
      name: 'Deyvi Test',
      email: 'test@example.com',
      password: 'Password123!',
    };

    service.register(registerReq).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/auth/register');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(service.isAuthenticated()).toBe(true);
  });

  it('restores the browser session from the server cookie after a reload', async () => {
    const restored = service.ensureSession();
    let authenticated = false;
    restored.subscribe((value) => (authenticated = value));

    httpMock.expectOne('http://localhost:8080/api/v1/users/me').flush({
      id: 'user-1', tenantId: 'tenant-1', name: 'Deyvi Test', email: 'test@example.com', roles: ['ROLE_USER'],
    });

    expect(authenticated).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUserSignal()?.email).toBe('test@example.com');
  });

  it('should logout user and navigate to login', () => {
    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUserSignal()).toBeNull();
    expect(localStorage.getItem('saas_auth_token')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    httpMock.expectOne('http://localhost:8080/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
  });
});
