import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.css',
})
export class AcceptInvitationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.fragment?.startsWith('token=')
    ? this.route.snapshot.fragment.slice('token='.length)
    : '';
  readonly validLink = /^[A-Za-z0-9_-]{40,64}$/.test(this.token);
  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly acceptedEmail = signal('');

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  submit(): void {
    if (!this.validLink || this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    const { name, password } = this.form.getRawValue();
    this.auth.acceptInvitation(this.token, name ?? '', password ?? '').subscribe({
      next: (result) => {
        this.loading.set(false);
        this.acceptedEmail.set(result.email);
      },
      error: (error: { error?: { message?: string } }) => {
        this.loading.set(false);
        this.errorMessage.set(error.error?.message || 'El enlace ya venció, fue revocado o ya se utilizó. Pide una invitación nueva.');
      },
    });
  }
}
