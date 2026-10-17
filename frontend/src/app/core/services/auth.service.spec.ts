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
    token: 'jwt-test-token-12345',
    type: 'Bearer',
    userId: 'user-1',
    tenantId: 'tenant-1',
    name: 'Deyvi Test',
    email: 'test@example.com',
    roles: ['ROLE_USER'],
  };

  beforeEach(() => {
    localStorage.clear();
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

  it('should be created and start unauthenticated if localstorage is empty', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(service.currentUserSignal()).toBeNull();
  });

  it('should login user and save session to localStorage and signals', () => {
    const loginReq: LoginRequest = { email: 'test@example.com', password: 'Password123!' };

    service.login(loginReq).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(loginReq);
    req.flush(mockResponse);

    expect(service.getToken()).toBe(mockResponse.token);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUserSignal()?.name).toBe('Deyvi Test');
    expect(localStorage.getItem('saas_auth_token')).toBe(mockResponse.token);
  });

  it('should register user and save session to localStorage', () => {
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

    expect(service.getToken()).toBe(mockResponse.token);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should logout user and clear localStorage and navigate to login', () => {
    localStorage.setItem('saas_auth_token', 'initial-token');
    service.tokenSignal.set('initial-token');

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUserSignal()).toBeNull();
    expect(localStorage.getItem('saas_auth_token')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
