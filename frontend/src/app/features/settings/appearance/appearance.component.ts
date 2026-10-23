import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AccentColor, AppearanceSettings } from '../../../core/models/tenant.model';

interface PaletteOption {
  id: AccentColor;
  name: string;
  hex: string;
}

@Component({
  selector: 'app-appearance',
  standalone: true,
  templateUrl: './appearance.component.html',
  styleUrl: './appearance.component.css',
})
export class AppearanceComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  readonly themeService = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly options: PaletteOption[] = [
    { id: 'red', name: 'Rojo', hex: '#c93640' },
    { id: 'blue', name: 'Azul', hex: '#2563eb' },
    { id: 'green', name: 'Verde', hex: '#047857' },
    { id: 'yellow', name: 'Amarillo', hex: '#a16207' },
  ];
  readonly isAdmin = signal(this.auth.currentUserSignal()?.roles?.includes('ROLE_ADMIN') ?? false);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly savingUser = signal(false);
  readonly savingPolicy = signal(false);
  readonly selected = signal<AccentColor>(this.themeService.accentColor());
  readonly savedAccent = signal<AccentColor>(this.themeService.accentColor());
  readonly defaultColor = signal<AccentColor>('red');
  readonly allowed = signal<AccentColor[]>(['red', 'blue', 'green', 'yellow']);
  readonly success = signal('');
  readonly error = signal('');
  readonly selectedName = () => this.options.find((option) => option.id === this.selected())?.name ?? '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    this.tenantService.getAppearance().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.loadFailed.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.error.set('No se pudo cargar la apariencia. Puedes reintentar.');
      },
    });
  }

  choose(color: AccentColor): void {
    if (!this.allowed().includes(color)) return;
    this.selected.set(color);
    this.themeService.setAccentColor(color);
    this.success.set('');
    this.error.set('');
  }

  saveUserPreference(): void {
    if (this.savingUser()) return;
    const color = this.selected();
    this.savingUser.set(true);
    this.success.set('');
    this.error.set('');
    this.tenantService.updateUserAccent(color).pipe(finalize(() => this.savingUser.set(false))).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.success.set('Tu color se guardó en tu cuenta.');
      },
      error: (err: { error?: { message?: string } }) => {
        this.reconcileAfterRejectedPreference(
          err.error?.message || 'No se pudo guardar tu color. Inténtalo de nuevo.',
        );
      },
    });
  }

  toggleAllowed(color: AccentColor, checked: boolean): void {
    const current = this.allowed();
    const next = checked ? [...current, color] : current.filter((item) => item !== color);
    if (!next.length) {
      this.error.set('Debe quedar al menos un color habilitado.');
      return;
    }
    this.allowed.set(next);
    if (!next.includes(this.defaultColor())) this.defaultColor.set(next[0]);
    if (!next.includes(this.selected())) {
      this.selected.set(this.defaultColor());
      this.themeService.setAccentColor(this.defaultColor());
    }
    this.error.set('');
    this.success.set('');
  }

  setDefault(color: AccentColor): void {
    if (this.allowed().includes(color)) this.defaultColor.set(color);
  }

  handlePaletteKeydown(event: KeyboardEvent, color: AccentColor): void {
    const enabled = this.options.filter((option) => this.allowed().includes(option.id));
    const index = enabled.findIndex((option) => option.id === color);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta || index < 0) return;
    event.preventDefault();
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    this.choose(next.id);
    document.querySelector<HTMLButtonElement>(`[data-palette="${next.id}"]`)?.focus();
  }

  savePolicy(): void {
    if (!this.isAdmin() || this.savingPolicy() || !this.allowed().includes(this.defaultColor())) return;
    this.savingPolicy.set(true);
    this.error.set('');
    this.success.set('');
    this.tenantService.updateAppearancePolicy({
      defaultAccentColor: this.defaultColor(),
      allowedAccentColors: this.allowed(),
    }).pipe(finalize(() => this.savingPolicy.set(false))).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.success.set('Paleta predeterminada y opciones permitidas guardadas.');
      },
      error: (err: { error?: { message?: string } }) => {
        this.error.set(err.error?.message || 'No se pudo guardar la política de colores.');
      },
    });
  }

  private applySettings(settings: AppearanceSettings): void {
    this.isAdmin.set(settings.administrator);
    this.allowed.set(settings.allowedAccentColors);
    this.defaultColor.set(settings.defaultAccentColor);
    this.selected.set(settings.userAccentColor);
    this.savedAccent.set(settings.userAccentColor);
    this.themeService.setAccentColor(settings.userAccentColor);
  }

  private reconcileAfterRejectedPreference(message: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.tenantService.getAppearance().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (settings) => {
        this.applySettings(settings);
        this.error.set(message);
      },
      error: () => {
        this.loadFailed.set(true);
        this.error.set(message);
      },
    });
  }
}
