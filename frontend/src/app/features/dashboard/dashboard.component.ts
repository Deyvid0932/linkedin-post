import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AutomationStateService } from '../../core/services/automation-state.service';
import { TenantService } from '../../core/services/tenant.service';
import { PublicationService } from '../../core/services/publication.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardStats } from '../../core/models/tenant.model';
import { PublicationLog } from '../../core/models/publication.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  readonly automation = inject(AutomationStateService);
  private readonly tenant = inject(TenantService);
  private readonly publications = inject(PublicationService);
  private readonly auth = inject(AuthService);
  readonly stats = signal<DashboardStats | null>(null);
  readonly queue = signal<PublicationLog[]>([]);
  readonly recent = signal<PublicationLog[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly queueError = signal(false);
  readonly recentError = signal(false);
  readonly firstName = computed(
    () => this.auth.currentUserSignal()?.name?.split(' ')[0] || 'bienvenido',
  );
  readonly hasContent = computed(() => this.queue().length > 0 || this.recent().length > 0);
  readonly hasSchedule = computed(() => (this.stats()?.activeSchedules ?? 0) > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.queueError.set(false);
    this.recentError.set(false);
    this.automation.load();
    let pending = 3;
    const finish = () => {
      pending--;
      if (pending === 0) this.loading.set(false);
    };
    const fail = () => {
      this.error.set(
        'No pudimos consultar todos tus datos. Revisa la conexión e inténtalo de nuevo.',
      );
      finish();
    };
    this.tenant
      .getDashboardStats()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => this.stats.set(value),
        error: () => this.error.set('No pudimos cargar el estado de la cuenta.'),
      });
    this.publications
      .getQueue()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => this.queue.set(value),
        error: () => {
          this.queueError.set(true);
          this.error.set('No pudimos cargar la cola de publicaciones.');
        },
      });
    this.publications
      .getHistory(0, 4)
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => this.recent.set(value.content),
        error: () => {
          this.recentError.set(true);
          this.error.set('No pudimos cargar la actividad reciente.');
        },
      });
  }

  statusLabel(status: string): string {
    return (
      (
        {
          SUCCESS: 'Publicado',
          FAILED: 'Fallido',
          PENDING: 'Pendiente',
          DRAFT: 'Borrador',
        } as Record<string, string>
      )[status] || status
    );
  }
}
