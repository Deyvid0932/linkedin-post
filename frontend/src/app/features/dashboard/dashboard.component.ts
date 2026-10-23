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
import { ContentDraft, ContentDraftService } from '../../core/services/content-draft.service';
import { TopicService } from '../../core/services/topic.service';
import { Schedule, ScheduleService } from '../../core/services/schedule.service';
import { parseRecurring } from '../../core/services/schedule-format';

interface DashboardMetrics {
  published: number | null;
  queued: number | null;
  ideas: number | null;
  drafts: number | null;
}

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
  private readonly drafts = inject(ContentDraftService);
  private readonly topics = inject(TopicService);
  private readonly auth = inject(AuthService);
  private readonly scheduleService = inject(ScheduleService);
  readonly stats = signal<DashboardStats | null>(null);
  readonly queue = signal<PublicationLog[]>([]);
  readonly recent = signal<PublicationLog[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly queueError = signal(false);
  readonly recentError = signal(false);
  readonly draftsError = signal(false);
  readonly savedDrafts = signal<ContentDraft[]>([]);
  readonly schedules = signal<Schedule[]>([]);
  readonly scheduleError = signal(false);
  readonly timezone = signal<string | null>(null);
  readonly weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  readonly activeDays = computed(() => new Set(this.schedules().filter(s => s.isActive).flatMap(s => parseRecurring(s.cronExpression)?.days ?? [])));
  readonly customSchedules = computed(() => this.schedules().filter(s => s.isActive && !parseRecurring(s.cronExpression)).length);
  readonly metrics = signal<DashboardMetrics>({ published: null, queued: null, ideas: null, drafts: null });
  readonly firstName = computed(
    () => this.auth.currentUserSignal()?.name?.split(' ')[0] || 'bienvenido',
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.queueError.set(false);
    this.recentError.set(false);
    this.draftsError.set(false);
    this.scheduleError.set(false);
    this.stats.set(null);
    this.metrics.set({ published: null, queued: null, ideas: null, drafts: null });
    this.automation.load();
    let pending = 7;
    const finish = () => {
      pending--;
      if (pending === 0) this.loading.set(false);
    };
    this.tenant
      .getDashboardStats()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => {
          this.stats.set(value);
          this.setMetric('published', value.successCount);
        },
        error: () => this.error.set('No pudimos cargar el estado de la cuenta.'),
      });
    this.publications
      .getQueue()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => {
          this.queue.set(value);
          this.setMetric('queued', value.length);
        },
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
    this.topics
      .getTopics()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => this.setMetric('ideas', value.length),
        error: () => this.error.set('No pudimos cargar el conteo de ideas.'),
      });
    this.drafts
      .list()
      .pipe(finalize(finish))
      .subscribe({
        next: (value) => {
          const drafts = value.filter(draft => !draft.queued).sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
          this.savedDrafts.set(drafts);
          this.setMetric('drafts', drafts.length);
        },
        error: () => { this.draftsError.set(true); this.error.set('No pudimos cargar el conteo de borradores.'); },
      });
    this.scheduleService.getSchedules().pipe(finalize(finish)).subscribe({
      next: (value) => this.schedules.set(value),
      error: () => { this.schedules.set([]); this.scheduleError.set(true); },
    });
    this.tenant.getProfile().pipe(finalize(finish)).subscribe({
      next: (value) => {
        try { new Intl.DateTimeFormat('es', { timeZone: value.timezone }).format(); this.timezone.set(value.timezone); }
        catch { this.timezone.set(null); }
      },
      error: () => this.timezone.set(null),
    });
  }

  metricValue(value: number | null): string | number {
    if (value !== null) return value;
    return this.loading() ? 'Cargando…' : 'No disponible';
  }

  private setMetric(key: keyof DashboardMetrics, value: number): void {
    this.metrics.update((current) => ({ ...current, [key]: value }));
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
