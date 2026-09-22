import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceMock: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authServiceMock = {
      getToken: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header when token exists', () => {
    authServiceMock.getToken.mockReturnValue('test-jwt-token-123');

    http.get('/api/v1/publications').subscribe();

    const req = httpMock.expectOne('/api/v1/publications');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token-123');
    req.flush([]);
  });

  it('should not add Authorization header when token is null', () => {
    authServiceMock.getToken.mockReturnValue(null);

    http.get('/api/v1/publications').subscribe();

    const req = httpMock.expectOne('/api/v1/publications');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });
});
