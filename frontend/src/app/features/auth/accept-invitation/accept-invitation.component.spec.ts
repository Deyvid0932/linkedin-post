import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AcceptInvitationComponent } from './accept-invitation.component';

describe('AcceptInvitationComponent', () => {
  const token = 'A'.repeat(43);
  let auth: { acceptInvitation: ReturnType<typeof vi.fn> };

  async function create(fragment: string | null) {
    auth = { acceptInvitation: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AcceptInvitationComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { fragment } } },
      ],
    }).compileComponents();
    return TestBed.createComponent(AcceptInvitationComponent);
  }

  it('creates the invited account and displays its email on success', async () => {
    const fixture = await create(`token=${token}`);
    const component = fixture.componentInstance;
    auth.acceptInvitation.mockReturnValue(of({ email: 'person@example.com', message: 'ok' }));
    component.form.setValue({ name: 'Persona Invitada', password: 'secure-password' });

    component.submit();
    fixture.detectChanges();

    expect(auth.acceptInvitation).toHaveBeenCalledWith(token, 'Persona Invitada', 'secure-password');
    expect(component.acceptedEmail()).toBe('person@example.com');
    expect(fixture.nativeElement.textContent).toContain('Tu cuenta está lista');
  });

  it('rejects a missing token and shows recoverable errors for a stale invite', async () => {
    const invalidFixture = await create(null);
    expect(invalidFixture.componentInstance.validLink).toBe(false);
    invalidFixture.componentInstance.form.setValue({ name: 'Persona', password: 'secure-password' });
    invalidFixture.componentInstance.submit();
    expect(auth.acceptInvitation).not.toHaveBeenCalled();

    TestBed.resetTestingModule();
    const fixture = await create(`token=${token}`);
    auth.acceptInvitation.mockReturnValue(throwError(() => ({ error: { message: 'Invitación vencida' } })));
    fixture.componentInstance.form.setValue({ name: 'Persona', password: 'secure-password' });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.errorMessage()).toBe('Invitación vencida');
  });
});
