import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarComponent } from './sidebar.component';

describe('Compact workspace navigation', () => {
  const logout = vi.fn();
  function setup() {
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: {
        currentUserSignal: signal({ name: 'Deyvid Silva', email: 'deyvid@example.test', roles: ['ROLE_ADMIN'] }),
        logout,
      } }],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return fixture;
  }
  beforeEach(() => logout.mockReset());
  it('shows five main destinations and keeps technical settings out of the main menu', () => {
    const fixture = setup();
    const links = Array.from(fixture.nativeElement.querySelectorAll('#primary-navigation>.app-nav-link')) as HTMLAnchorElement[];
    expect(links.map(link => link.textContent?.trim())).toEqual(['Inicio', 'Crear', 'Publicaciones', 'Ideas', 'Rendimiento']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/dashboard','/compose','/calendar','/topics','/insights']);
    const nav = fixture.nativeElement.querySelector('#primary-navigation');
    expect(nav.textContent).not.toMatch(/Proveedores|Webhooks|Repositorios|Administración/);
    expect(nav.querySelector('[aria-label="Gestionar LinkedIn"]')?.getAttribute('href')).toBe('/settings/channels');
  });
  it('opens exactly Settings, Help and Log out and closes on outside click', async () => {
    const fixture = setup();
    (fixture.nativeElement.querySelector('.app-profile-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('#profile-options') as HTMLElement;
    expect(Array.from(panel.querySelectorAll('a,button')).map(link => link.textContent?.trim())).toEqual(['Settings','Help','Log out']);
    expect(panel.querySelector('a')?.getAttribute('href')).toBe('/settings/profile');
    expect(document.activeElement).toBe(panel.querySelector('a'));
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#profile-options')).toBeNull();
  });
  it('returns keyboard focus to the account button on Escape', async () => {
    const fixture = setup();
    const trigger = fixture.nativeElement.querySelector('.app-profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.profileOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
  it('closes the account menu and logs out only when Log out is clicked', () => {
    const fixture = setup();
    fixture.componentInstance.toggleProfileMenu();
    fixture.detectChanges();
    expect(logout).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('#profile-options button') as HTMLButtonElement).click();
    expect(logout).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.profileOpen()).toBe(false);
  });
  it('keeps Publications and Ideas active for their child views', () => {
    const fixture = setup();
    fixture.componentInstance.currentPath.set('/queue');
    expect(fixture.componentInstance.isActive('/calendar')).toBe(true);
    fixture.componentInstance.currentPath.set('/publications');
    expect(fixture.componentInstance.isActive('/calendar')).toBe(true);
    fixture.componentInstance.currentPath.set('/library');
    expect(fixture.componentInstance.isActive('/topics')).toBe(true);
    expect(fixture.componentInstance.isActive('/calendar')).toBe(false);
  });
});
