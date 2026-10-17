import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { SidebarComponent } from './sidebar.component';

describe('Sidebar profile menu', () => {
  it('opens the three account actions and closes when clicking outside', () => {
    const user = signal({
      userId: 'u1',
      tenantId: 't1',
      name: 'Deyvid',
      email: 'deyvid@example.com',
      roles: ['USER'],
    });
    TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUserSignal: user, logout: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('footer details') as HTMLDetailsElement;
    const summary = details.querySelector('summary') as HTMLElement;
    summary.click();
    fixture.detectChanges();
    expect(details.open).toBe(true);
    expect(fixture.nativeElement.querySelector('#profile-options').textContent).toContain('Perfil');
    expect(fixture.nativeElement.querySelector('#profile-options').textContent).toContain(
      'Seguridad',
    );
    expect(fixture.nativeElement.querySelector('#profile-options').textContent).toContain(
      'Cerrar sesión',
    );
    document.body.click();
    expect(details.open).toBe(false);
  });
});
