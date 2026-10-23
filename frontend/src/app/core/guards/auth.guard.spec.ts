import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { Observable, firstValueFrom, of } from 'rxjs';

describe('authGuard', () => {
  let authServiceMock: { ensureSession: ReturnType<typeof vi.fn> };
  let routerMock: { createUrlTree: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authServiceMock = {
      ensureSession: vi.fn(),
    };
    routerMock = {
      createUrlTree: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('should allow access when user is authenticated', async () => {
    authServiceMock.ensureSession.mockReturnValue(of(true));

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(await firstValueFrom(result as Observable<boolean | UrlTree>)).toBe(true);
  });

  it('should redirect to /auth/login with returnUrl query param when user is not authenticated', async () => {
    authServiceMock.ensureSession.mockReturnValue(of(false));
    const mockUrlTree = {} as UrlTree;
    routerMock.createUrlTree.mockReturnValue(mockUrlTree);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(await firstValueFrom(result as Observable<boolean | UrlTree>)).toBe(mockUrlTree);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/dashboard' },
    });
  });
});
