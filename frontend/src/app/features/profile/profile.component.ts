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
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly user = this.auth.currentUserSignal;
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({ name: [this.user()?.name || '', [Validators.required, Validators.maxLength(120)]] });
  initials(): string { return (this.user()?.name || 'Usuario').split(' ').filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase(); }
  save(): void {
    if(this.saving()) return;
    this.message.set(''); this.error.set(''); this.form.markAllAsTouched();
    const name = this.form.controls.name.value.trim();
    if(this.form.invalid || !name) { this.error.set('Escribe tu nombre (máximo 120 caracteres).'); return; }
    this.saving.set(true);
    this.auth.updateProfile(name, '', '').subscribe({
      next: () => { this.saving.set(false); this.form.markAsPristine(); this.message.set('Tu perfil se actualizó.'); },
      error: (err) => { this.saving.set(false); this.error.set(err?.error?.message || 'No pudimos actualizar tu perfil. Inténtalo de nuevo.'); },
    });
  }
}
