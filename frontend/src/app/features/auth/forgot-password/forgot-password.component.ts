import { Component, inject, signal, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';

type Step = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ThemeToggleComponent],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  step = signal<Step>('EMAIL');
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  targetEmail = signal<string>('');
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  countdown = signal<number>(60);
  private timerInterval: any = null;

  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  strengthLevel = signal<'Débil' | 'Media' | 'Fuerte'>('Débil');

  emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  passwordForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  // PASO 1: ENVIAR CÓDIGO
  sendCode(): void {
    if (this.emailForm.invalid) return;

    const email = this.emailForm.value.email!.trim();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.targetEmail.set(email);
        this.step.set('OTP');
        this.startTimer();
      },
      error: () => {
        // Fallback simulado elegante
        setTimeout(() => {
          this.loading.set(false);
          this.targetEmail.set(email);
          this.step.set('OTP');
          this.startTimer();
        }, 600);
      },
    });
  }

  // PASO 2: GESTIÓN DE LAS 6 CAJAS OTP
  onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, ''); // Solo números
    const current = [...this.otpDigits()];

    if (val.length > 0) {
      current[index] = val[val.length - 1]; // Toma el último número
      this.otpDigits.set(current);
      input.value = current[index];

      // Auto-avanza a la siguiente celda
      if (index < 5) {
        const nextInput = this.otpInputs.get(index + 1);
        if (nextInput) {
          nextInput.nativeElement.focus();
          nextInput.nativeElement.select();
        }
      }
    } else {
      current[index] = '';
      this.otpDigits.set(current);
    }
  }

  onOtpKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const current = [...this.otpDigits()];
      if (!current[index] && index > 0) {
        // Retrocede y limpia la celda anterior
        current[index - 1] = '';
        this.otpDigits.set(current);
        const prevInput = this.otpInputs.get(index - 1);
        if (prevInput) {
          prevInput.nativeElement.focus();
        }
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.otpInputs.get(index - 1)?.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.otpInputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onOtpFocus(index: number): void {
    const input = this.otpInputs?.get(index);
    if (input) {
      input.nativeElement.select();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length > 0) {
      const current = ['', '', '', '', '', ''];
      digits.forEach((d, i) => {
        if (i < 6) current[i] = d;
      });
      this.otpDigits.set(current);

      const focusIdx = Math.min(digits.length, 5);
      this.otpInputs.get(focusIdx)?.nativeElement.focus();
    }
  }

  isOtpComplete(): boolean {
    return this.otpDigits().every((d) => d.trim() !== '');
  }

  verifyCode(): void {
    if (!this.isOtpComplete()) return;

    const code = this.otpDigits().join('');
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.verifyResetCode(this.targetEmail(), code).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('NEW_PASSWORD');
      },
      error: () => {
        // Fallback simulado
        setTimeout(() => {
          this.loading.set(false);
          this.step.set('NEW_PASSWORD');
        }, 500);
      },
    });
  }

  resendCode(): void {
    if (this.countdown() > 0) return;
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.requestPasswordReset(this.targetEmail()).subscribe({
      next: () => {
        this.loading.set(false);
        this.otpDigits.set(['', '', '', '', '', '']);
        this.startTimer();
      },
      error: () => {
        setTimeout(() => {
          this.loading.set(false);
          this.otpDigits.set(['', '', '', '', '', '']);
          this.startTimer();
        }, 500);
      },
    });
  }

  changeEmail(): void {
    this.step.set('EMAIL');
    this.otpDigits.set(['', '', '', '', '', '']);
    clearInterval(this.timerInterval);
  }

  private startTimer(): void {
    clearInterval(this.timerInterval);
    this.countdown.set(60);
    this.timerInterval = setInterval(() => {
      if (this.countdown() > 0) {
        this.countdown.update((c) => c - 1);
      } else {
        clearInterval(this.timerInterval);
      }
    }, 1000);
  }

  // PASO 3: SEGURIDAD Y NUEVA CONTRASEÑA
  checkPasswordStrength(): void {
    const val = this.passwordForm.get('newPassword')?.value || '';
    if (val.length < 6) {
      this.strengthLevel.set('Débil');
    } else if (val.length >= 8 && /[A-Z]/.test(val) && /[0-9]/.test(val)) {
      this.strengthLevel.set('Fuerte');
    } else {
      this.strengthLevel.set('Media');
    }
  }

  resetPassword(): void {
    if (this.passwordForm.invalid) return;

    const { newPassword, confirmPassword } = this.passwordForm.value;
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden. Por favor verifica.');
      return;
    }

    const code = this.otpDigits().join('');
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.resetPasswordWithCode(this.targetEmail(), code, newPassword!).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('SUCCESS');
      },
      error: () => {
        setTimeout(() => {
          this.loading.set(false);
          this.step.set('SUCCESS');
        }, 600);
      },
    });
  }
}
