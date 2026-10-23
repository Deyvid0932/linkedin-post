import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-password-change',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="settings-section" aria-labelledby="change-password-title">
      <h2 id="change-password-title" class="ui-section-title">Cambiar contraseña</h2>
      <p class="ui-muted">Confirma tu contraseña actual. Al cambiarla, tendrás que iniciar sesión de nuevo.</p>
      <form [formGroup]="form" (ngSubmit)="save()" class="settings-form">
        <label for="current-password">Contraseña actual<input id="current-password" class="ui-input" [type]="showPasswords() ? 'text' : 'password'" autocomplete="current-password" formControlName="currentPassword" /></label>
        <label for="new-password">Nueva contraseña<input id="new-password" class="ui-input" [type]="showPasswords() ? 'text' : 'password'" autocomplete="new-password" formControlName="newPassword" />
          @if(form.controls.newPassword.touched && form.controls.newPassword.invalid) { <small class="settings-field-error">Usa al menos 6 caracteres.</small> }
        </label>
        <label for="confirm-password">Confirmar contraseña<input id="confirm-password" class="ui-input" [type]="showPasswords() ? 'text' : 'password'" autocomplete="new-password" formControlName="confirmPassword" />
          @if(form.controls.confirmPassword.touched && form.controls.confirmPassword.value !== form.controls.newPassword.value) { <small class="settings-field-error">Las contraseñas no coinciden.</small> }
        </label>
        <label class="settings-checkbox"><input type="checkbox" [checked]="showPasswords()" (change)="showPasswords.set(!showPasswords())" /> Mostrar contraseñas</label>
        @if(error()) { <p role="alert" class="settings-field-error">{{ error() }}</p> }
        <div class="settings-form-actions"><button type="submit" class="ui-button ui-button--primary" [disabled]="saving()">{{ saving() ? 'Guardando…' : 'Cambiar contraseña' }}</button></div>
      </form>
    </section>`,
})
export class PasswordChangeComponent {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly showPasswords = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });
  save(): void {
    if(this.saving()) return;
    this.error.set('');
    this.form.markAllAsTouched();
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if(!currentPassword) { this.error.set('Escribe tu contraseña actual.'); return; }
    if(this.form.invalid) { this.error.set('Revisa los campos antes de guardar.'); return; }
    if(newPassword !== confirmPassword) { this.error.set('Las contraseñas no coinciden.'); return; }
    this.saving.set(true);
    this.auth.updateProfile(undefined, currentPassword, newPassword).subscribe({
      next: () => { this.form.reset(); this.auth.logout({ passwordUpdated: 'true' }); },
      error: (err) => { this.saving.set(false); this.error.set(err?.error?.message || 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.'); },
    });
  }
}
