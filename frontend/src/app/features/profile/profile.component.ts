import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUserSignal;
  readonly saving = signal(false);
  readonly showPasswords = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: [this.user()?.name || '', [Validators.required, Validators.maxLength(120)]],
    currentPassword: [''],
    newPassword: ['', Validators.minLength(6)],
    confirmPassword: [''],
  });

  save(): void {
    this.message.set('');
    this.error.set('');
    if (this.saving()) return;
    this.form.markAllAsTouched();
    const { name, currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (this.form.invalid || !name.trim()) {
      this.error.set('Revisa los campos antes de guardar.');
      return;
    }
    if (newPassword && !currentPassword) {
      this.error.set('Escribe tu contraseña actual para cambiarla.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      this.error.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    if (confirmPassword && !newPassword) {
      this.error.set('Escribe la nueva contraseña que quieres confirmar.');
      return;
    }
    this.saving.set(true);
    this.auth.updateProfile(name, currentPassword, newPassword).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.patchValue({ currentPassword: '', newPassword: '', confirmPassword: '' });
        if (newPassword) {
          this.auth.logout({ passwordUpdated: 'true' });
          return;
        }
        this.message.set('Tu perfil se actualizó.');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(
          err?.error?.message ||
            'No pudimos actualizar el perfil. Comprueba tus datos e inténtalo otra vez.',
        );
      },
    });
  }
}
