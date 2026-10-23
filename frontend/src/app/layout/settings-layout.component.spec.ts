import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../app.routes';
import { AuthService } from '../core/services/auth.service';
import { TenantService } from '../core/services/tenant.service';
import { CredentialService } from '../core/services/credential.service';

describe('Full-page Settings routing', () => {
  const user = signal({userId:'u1',tenantId:'t1',name:'Deyvid',email:'deyvid@example.test',roles:['ROLE_USER']});
  beforeEach(() => {
    user.update(value => ({...value,roles:['ROLE_USER']}));
    TestBed.configureTestingModule({providers:[
      provideRouter(routes),
      {provide:AuthService,useValue:{currentUserSignal:user,ensureSession:() => of(true),refreshCurrentUser:() => of(user()),logout:vi.fn(),updateProfile:vi.fn()}},
      {provide:TenantService,useValue:{getAppearance:() => of({userAccentColor:'red',allowedAccentColors:['red'],defaultAccentColor:'red',administrator:false})}},
      {provide:CredentialService,useValue:{getLinkedInAccounts:() => of([])}},
    ]});
  });
  it('opens Settings from a legacy profile URL without rendering the main app sidebar', async () => {
    const harness = await RouterTestingHarness.create('/profile?source=legacy');
    expect(TestBed.inject(Router).url).toBe('/settings/profile?source=legacy');
    const page = harness.fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.settings-sidebar')).not.toBeNull();
    expect(page.querySelector('.app-sidebar')).toBeNull();
    expect(page.querySelector('h1')?.textContent).toBe('Perfil');
    expect(page.querySelector('#profile-email')).not.toBeNull();
    expect(page.querySelector('[href="/settings/admin"]')).toBeNull();
    user.update(value => ({...value,roles:['ROLE_ADMIN']}));
    harness.detectChanges();
    expect(page.querySelector('[href="/settings/admin"]')).not.toBeNull();
  });
  it('preserves old Security, password-fragment and channel links', async () => {
    const harness = await RouterTestingHarness.create('/profile/security');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/settings/security');
    expect(harness.fixture.nativeElement.querySelector('#current-password')).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('[href="/auth/forgot-password"]')).toBeNull();
    await harness.navigateByUrl('/profile#password');
    expect(router.url).toBe('/settings/security');
    await harness.navigateByUrl('/connections');
    expect(router.url).toBe('/settings/channels');
    await harness.navigateByUrl('/settings/linkedin');
    expect(router.url).toBe('/settings/channels');
    expect(harness.fixture.nativeElement.querySelector('h1')?.textContent).toBe('Canales');
  });
  it('provides a mobile Settings drawer with Escape and focus return', async () => {
    const harness = await RouterTestingHarness.create('/settings');
    const page = harness.fixture.nativeElement as HTMLElement;
    const trigger = page.querySelector('button[aria-controls="settings-navigation"]') as HTMLButtonElement;
    trigger.click(); harness.detectChanges(); await harness.fixture.whenStable();
    expect(page.querySelector('.settings-sidebar')?.getAttribute('aria-modal')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); harness.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });
  it('handles an OAuth cancellation through the previous callback destination', async () => {
    const harness = await RouterTestingHarness.create('/settings/linkedin?linkedin_oauth=cancelled');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/settings/channels');
    expect(harness.fixture.nativeElement.textContent).toContain('Cancelaste la autorización de LinkedIn');
  });
});
