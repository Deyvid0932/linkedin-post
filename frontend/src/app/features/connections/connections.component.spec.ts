import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AiConnectionsService } from '../../core/services/ai-connections.service';
import { CredentialService } from '../../core/services/credential.service';
import { ConnectionsComponent } from './connections.component';

describe('ConnectionsComponent', () => {
  let fixture: ComponentFixture<ConnectionsComponent>;
  let credentials: {
    getLinkedInAccounts: ReturnType<typeof vi.fn>;
    getGitHubStatus: ReturnType<typeof vi.fn>;
    getMonitoredRepos: ReturnType<typeof vi.fn>;
  };
  let aiConnections: { getStatuses: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    credentials = {
      getLinkedInAccounts: vi.fn(() => of([{
        id: 'account-1', accountType: 'PERSON', authorUrn: 'urn:li:person:1', displayName: 'Deyvid',
        isEnabled: true, isPrimary: true, isValid: true, daysRemaining: 30, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00Z',
      }])),
      getGitHubStatus: vi.fn(() => of({ connected: true, username: 'deyvid' })),
      getMonitoredRepos: vi.fn(() => of([{ id: 'repo-1', repoOwner: 'deyvid', repoName: 'autopost', isActive: true, createdAt: '2026-01-01T00:00:00Z' }])),
    };
    aiConnections = {
      getStatuses: vi.fn(() => of([
        { provider: 'deepseek-text', label: 'DeepSeek', workspaceKeyConfigured: true, serverFallbackConfigured: false, effectiveSource: 'WORKSPACE', updatedAt: null },
        { provider: 'nanogpt-image', label: 'NanoGPT', workspaceKeyConfigured: false, serverFallbackConfigured: false, effectiveSource: 'NONE', updatedAt: null },
      ])),
    };
    TestBed.configureTestingModule({
      imports: [ConnectionsComponent],
      providers: [
        provideRouter([]),
        { provide: CredentialService, useValue: credentials },
        { provide: AiConnectionsService, useValue: aiConnections },
      ],
    });
    fixture = TestBed.createComponent(ConnectionsComponent);
    fixture.detectChanges();
  });

  it('summarizes real LinkedIn, GitHub, repository and AI provider states', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('1 cuenta vinculada');
    expect(text).toContain('Conectado como @deyvid');
    expect(text).toContain('1 repositorio supervisado');
    expect(text).toContain('1 de 2 servicios con una credencial disponible');
    expect(text).toContain('Clave del espacio');
    expect(text).toContain('Sin configurar');
  });

  it('shows unavailable connection states after an API error instead of false zero counts', () => {
    credentials.getLinkedInAccounts.mockReturnValue(throwError(() => new Error('offline')));
    credentials.getGitHubStatus.mockReturnValue(throwError(() => new Error('offline')));
    aiConnections.getStatuses.mockReturnValue(throwError(() => new Error('offline')));

    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No se pudo consultar el estado de LinkedIn.');
    expect(fixture.nativeElement.textContent).toContain('No se pudo consultar el estado de GitHub.');
    expect(fixture.nativeElement.textContent).toContain('No se pudo consultar el estado de los proveedores de IA.');
    expect(fixture.nativeElement.textContent).not.toContain('0 cuentas vinculadas');
    expect(fixture.nativeElement.textContent).not.toContain('0 de 0 servicios');
  });

  it('keeps management actions pointed to the existing integration screens', () => {
    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(links).toContain('/settings/linkedin');
    expect(links).toContain('/settings/github');
    expect(links).toContain('/settings/ai-connections');
  });
});
