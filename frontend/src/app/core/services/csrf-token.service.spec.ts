import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CsrfTokenService } from './csrf-token.service';

describe('CsrfTokenService', () => {
  let service: CsrfTokenService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CsrfTokenService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CsrfTokenService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads one credentialed CSRF token and reuses it in memory', () => {
    let firstToken = '';
    let secondToken = '';
    service.getToken().subscribe((token) => (firstToken = token));
    service.getToken().subscribe((token) => (secondToken = token));

    const request = httpMock.expectOne('http://localhost:8080/api/v1/auth/csrf');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ token: 'csrf-value' });

    service.getToken().subscribe((token) => (secondToken = token));
    expect(firstToken).toBe('csrf-value');
    expect(secondToken).toBe('csrf-value');
    httpMock.expectNone('http://localhost:8080/api/v1/auth/csrf');
  });

  it('fetches a fresh token after the cache is cleared', () => {
    let token = '';
    service.getToken().subscribe((value) => (token = value));
    httpMock.expectOne('http://localhost:8080/api/v1/auth/csrf').flush({ token: 'stale' });
    expect(token).toBe('stale');

    service.clear();

    service.getToken().subscribe((value) => (token = value));
    httpMock
      .expectOne('http://localhost:8080/api/v1/auth/csrf')
      .flush({ token: 'fresh' });
    expect(token).toBe('fresh');
  });
});
