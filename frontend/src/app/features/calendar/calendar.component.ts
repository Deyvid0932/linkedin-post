import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PublicationLog } from '../../core/models/publication.model';
import { TenantService } from '../../core/services/tenant.service';
import { PublicationService } from '../../core/services/publication.service';
import { Schedule, ScheduleService } from '../../core/services/schedule.service';
import { parseRecurring } from '../../core/services/schedule-format';

type CalendarView = 'week' | 'month' | 'list';

interface CalendarSlot {
  id: string;
  time: string;
  description: string;
}

interface CalendarDay {
  key: string;
  weekday: string;
  dayNumber: number;
  label: string;
  currentMonth: boolean;
  today: boolean;
  slots: CalendarSlot[];
}

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DEFAULT_TIMEZONE = 'America/Lima';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.css',
})
export class CalendarComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly publicationService = inject(PublicationService);
  private readonly scheduleService = inject(ScheduleService);

  readonly view = signal<CalendarView>('week');
  readonly schedules = signal<Schedule[]>([]);
  readonly queuedPosts = signal<PublicationLog[]>([]);
  readonly timezone = signal(DEFAULT_TIMEZONE);
  readonly anchorDate = signal(this.todayForTimezone(DEFAULT_TIMEZONE));
  readonly loadingSchedules = signal(true);
  readonly loadingQueue = signal(true);
  readonly scheduleError = signal('');
  readonly queueError = signal('');

  readonly days = computed(() =>
    this.view() === 'week' ? this.buildWeek() : this.view() === 'month' ? this.buildMonth() : [],
  );
  readonly recurringSchedules = computed(() =>
    this.schedules()
      .filter((schedule) => schedule.isActive)
      .flatMap((schedule) => {
        const pattern = parseRecurring(schedule.cronExpression);
        return pattern
          ? [{ schedule, pattern }]
          : [];
      }),
  );
  readonly customSchedules = computed(() =>
    this.schedules().filter((schedule) => schedule.isActive && !parseRecurring(schedule.cronExpression)),
  );
  readonly periodLabel = computed(() => {
    const date = this.anchorDate();
    if (this.view() === 'month' || this.view() === 'list') {
      return new Intl.DateTimeFormat('es-PE', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    }
    const monday = this.startOfWeek(date);
    const sunday = this.plusDays(monday, 6);
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
    const from = new Intl.DateTimeFormat('es-PE', options).format(monday);
    const to = new Intl.DateTimeFormat('es-PE', {
      ...options,
      year: 'numeric',
    }).format(sunday);
    return `${from} – ${to}`;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadingSchedules.set(true);
    this.loadingQueue.set(true);
    this.scheduleError.set('');
    this.queueError.set('');

    this.tenantService.getTenantInfo().subscribe({
      next: (tenant) => {
        const timezone = tenant?.timezone || DEFAULT_TIMEZONE;
        this.timezone.set(timezone);
        this.anchorDate.set(this.todayForTimezone(timezone));
      },
      error: () => undefined,
    });
    this.scheduleService
      .getSchedules()
      .pipe(finalize(() => this.loadingSchedules.set(false)))
      .subscribe({
        next: (schedules) => this.schedules.set(schedules || []),
        error: () => this.scheduleError.set('No pudimos cargar los horarios recurrentes.'),
      });
    this.publicationService
      .getQueue()
      .pipe(finalize(() => this.loadingQueue.set(false)))
      .subscribe({
        next: (posts) => this.queuedPosts.set(posts || []),
        error: () => this.queueError.set('No pudimos cargar la cola de publicaciones.'),
      });
  }

  setView(view: CalendarView): void {
    this.view.set(view);
  }

  goToday(): void {
    this.anchorDate.set(this.todayForTimezone(this.timezone()));
  }

  movePeriod(direction: -1 | 1): void {
    const date = this.anchorDate();
    if (this.view() === 'month') {
      this.anchorDate.set(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1)));
      return;
    }
    this.anchorDate.set(this.plusDays(date, this.view() === 'week' ? direction * 7 : direction * 30));
  }

  private buildWeek(): CalendarDay[] {
    const monday = this.startOfWeek(this.anchorDate());
    return Array.from({ length: 7 }, (_, index) => this.toDay(this.plusDays(monday, index), true));
  }

  private buildMonth(): CalendarDay[] {
    const anchor = this.anchorDate();
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const mondayOffset = (first.getUTCDay() + 6) % 7;
    const start = this.plusDays(first, -mondayOffset);
    const last = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    const totalDays = mondayOffset + last.getUTCDate();
    const cellCount = Math.ceil(totalDays / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) =>
      this.toDay(this.plusDays(start, index), this.plusDays(start, index).getUTCMonth() === anchor.getUTCMonth()),
    );
  }

  private toDay(date: Date, currentMonth: boolean): CalendarDay {
    const dayIndex = (date.getUTCDay() + 6) % 7;
    const key = this.dateKey(date);
    const slots = this.recurringSchedules()
      .filter(({ pattern }) => pattern.days.includes(dayIndex))
      .map(({ schedule, pattern }) => ({
        id: schedule.id,
        time: pattern.time,
        description: schedule.description,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
    return {
      key,
      weekday: WEEKDAYS[dayIndex],
      dayNumber: date.getUTCDate(),
      label: new Intl.DateTimeFormat('es-PE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }).format(date),
      currentMonth,
      today: key === this.dateKey(this.todayForTimezone(this.timezone())),
      slots,
    };
  }

  private startOfWeek(date: Date): Date {
    return this.plusDays(date, -((date.getUTCDay() + 6) % 7));
  }

  private plusDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private todayForTimezone(timezone: string): Date {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
      return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    } catch {
      return this.todayForTimezone(DEFAULT_TIMEZONE);
    }
  }

  private dateKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
}
