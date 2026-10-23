import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CsrfTokenService } from '../services/csrf-token.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceMock: {
    logout: ReturnType<typeof vi.fn>;
    isSessionCheckInProgress: ReturnType<typeof vi.fn>;
  };
  let csrfTokenServiceMock: {
    getToken: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authServiceMock = {
      logout: vi.fn(),
      isSessionCheckInProgress: vi.fn(() => false),
    };
    csrfTokenServiceMock = {
      getToken: vi.fn(() => of('csrf-token')),
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: CsrfTokenService, useValue: csrfTokenServiceMock },
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sends API requests with browser credentials and without exposing a bearer token', () => {
    http.get('/api/v1/publications').subscribe();

    const req = httpMock.expectOne('/api/v1/publications');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('adds a CSRF header to state-changing API requests', () => {
    http.post('/api/v1/publications', {}).subscribe();
    const req = httpMock.expectOne('/api/v1/publications');
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-token');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('never leaks the session to an external or protocol-relative URL', () => {
    for (const url of [
      'https://other.test/api/v1/publications',
      '//other.test/api/v1/publications',
    ]) {
      http.get(url).subscribe();
      const req = httpMock.expectOne(url);
      expect(req.request.withCredentials).toBe(false);
      req.flush({});
    }
  });
  it('preserves the session when access is forbidden', () => {
    http.get('/api/v1/publications').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/publications').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(authServiceMock.logout).not.toHaveBeenCalled();
  });
  it('recovers a state-changing API request rejected by a stale CSRF token', () => {
    let result: unknown;
    csrfTokenServiceMock.getToken
      .mockReturnValueOnce(of('stale-token'))
      .mockReturnValueOnce(of('fresh-token'));

    http.post('/api/v1/credentials/linkedin/oauth/start', {}).subscribe({
      next: (value) => (result = value),
      error: () => (result = 'error'),
    });

    const first = httpMock.expectOne('/api/v1/credentials/linkedin/oauth/start');
    expect(first.request.headers.get('X-XSRF-TOKEN')).toBe('stale-token');
    first.flush({}, { status: 403, statusText: 'Forbidden' });

    const retry = httpMock.expectOne('/api/v1/credentials/linkedin/oauth/start');
    expect(retry.request.headers.get('X-XSRF-TOKEN')).toBe('fresh-token');
    retry.flush({ ok: true });

    expect(csrfTokenServiceMock.clear).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it('retries a CSRF rejection only once', () => {
    let result: unknown;
    http.post('/api/v1/credentials/linkedin/oauth/start', {}).subscribe({
      error: (error) => (result = error.status),
    });

    httpMock
      .expectOne('/api/v1/credentials/linkedin/oauth/start')
      .flush({}, { status: 403, statusText: 'Forbidden' });

    httpMock
      .expectOne('/api/v1/credentials/linkedin/oauth/start')
      .flush({}, { status: 403, statusText: 'Forbidden' });

    expect(result).toBe(403);
  });

  it('expires session only on an authentication failure from our API', () => {
    http.get('/api/v1/publications').subscribe({ error: () => {} });
    httpMock
      .expectOne('/api/v1/publications')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(authServiceMock.logout).toHaveBeenCalled();
  });

  it('leaves initial session restoration failures to the route guard', () => {
    authServiceMock.isSessionCheckInProgress.mockReturnValue(true);
    http.get('/api/v1/users/me').subscribe({ error: () => {} });
    httpMock.expectOne('/api/v1/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(authServiceMock.logout).not.toHaveBeenCalled();
  });
});
