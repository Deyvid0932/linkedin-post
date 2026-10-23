import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { TenantService } from './tenant.service';
@Injectable({ providedIn: 'root' })
export class AutomationStateService {
  private readonly tenant = inject(TenantService);
  readonly enabled = signal<boolean | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly label = computed(() =>
    this.enabled() === null
      ? 'Estado no disponible'
      : this.enabled()
        ? 'Publicación habilitada'
        : 'Publicación pausada',
  );
  readonly explanation =
    'Este control pausa la publicación programada del backend. El estado no confirma que el servidor esté disponible.';
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.tenant
      .getProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (t) => this.enabled.set(t.isActive && !t.isEmergencyPaused),
        error: () => {
          this.enabled.set(null);
          this.error.set('No pudimos consultar el estado del backend.');
        },
      });
  }
  toggle(): void {
    if (this.busy() || this.enabled() === null) return;
    this.busy.set(true);
    this.error.set('');
    (this.enabled() ? this.tenant.emergencyPause() : this.tenant.emergencyResume())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (r) => this.enabled.set(!r.isEmergencyPaused),
        error: () => {
          this.enabled.set(null);
          this.error.set('No se confirmó el cambio. Consulta de nuevo el estado.');
        },
      });
  }
}
