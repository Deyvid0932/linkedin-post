import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PasswordChangeComponent } from './password-change.component';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [FormsModule, PasswordChangeComponent],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUserSignal;
  readonly showPassword = signal(false);
  readonly confirmingRevoke = signal(false);
  readonly revoking = signal(false);
  readonly currentPassword = signal('');
  readonly error = signal('');

  roleLabel(role: string): string {
    if (role === 'ROLE_ADMIN') return 'Administrador';
    if (role === 'ROLE_USER') return 'Usuario';
    return role.replace(/^ROLE_/, '').replaceAll('_', ' ');
  }

  requestRevoke(): void {
    this.error.set('');
    this.currentPassword.set('');
    this.confirmingRevoke.set(true);
  }

  cancelRevoke(): void {
    if (this.revoking()) return;
    this.confirmingRevoke.set(false);
    this.currentPassword.set('');
    this.error.set('');
  }

  revokeSessions(): void {
    const password = this.currentPassword();
    this.error.set('');
    if (!password.trim()) {
      this.error.set('Escribe tu contraseña actual para continuar.');
      return;
    }
    if (this.revoking()) return;

    this.revoking.set(true);
    this.auth.revokeSessions(password).subscribe({
      next: () => this.auth.logout({ sessionsRevoked: 'true' }),
      error: (err) => {
        this.revoking.set(false);
        this.error.set(err?.error?.message || 'No pudimos cerrar las sesiones. Inténtalo de nuevo.');
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
