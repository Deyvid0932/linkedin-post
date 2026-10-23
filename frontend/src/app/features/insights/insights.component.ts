import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, catchError, finalize, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PostingDistribution, ScheduleService } from '../../core/services/schedule.service';
import { DailyContentSuggestion, DailySuggestionService } from '../../core/services/daily-suggestion.service';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { PublicationService } from '../../core/services/publication.service';
import { PublicationLog } from '../../core/models/publication.model';

interface DayBar { key: string; label: string; }

export function buildPostingReportCsv(report: PostingDistribution, period = 'Todo el historial'): string {
  const quote = (value: string | number): string => {
    let text = String(value);
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows: Array<Array<string | number>> = [
    ['Categoría', 'Indicador', 'Valor'],
    ['Informe', 'Periodo', period],
    ['Resumen', 'Publicaciones confirmadas', report.successfulPostsCount],
    ['Resumen', 'Publicaciones con fecha confirmada', report.publicationsWithPublishedAtCount],
    ['Resumen', 'Fallos registrados', report.failedPostsCount],
    ['Resumen', 'Tasa de éxito (%)', report.successRatePercentage ?? 'Sin datos'],
    ['Uso de IA', 'Tokens reportados por el proveedor', report.recordedTokens],
    ['Uso de IA', 'Tokens de entrada reportados', report.inputTokens],
    ['Uso de IA', 'Tokens de salida reportados', report.outputTokens],
    ['Uso de IA', 'Eventos de uso con datos reportados', report.usageEvents],
    ...Object.entries(report.tokensByModel)
      .sort((left, right) => right[1] - left[1])
      .map(([model, tokens]) => ['Tokens por modelo', model, tokens]),
    ...Object.entries(report.tokensByDay ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([day, tokens]) => ['Tokens de texto por día', day, tokens]),
    ...Object.entries(report.postsByHour)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([hour, count]) => ['Publicaciones por hora', `${hour.padStart(2, '0')}:00`, count]),
    ...Object.entries(report.postsByDayOfWeek)
      .map(([day, count]) => ['Publicaciones por día', day, count]),
  ];
  return `\uFEFF${rows.map((row) => row.map(quote).join(',')).join('\r\n')}`;
}

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.css',
})
export class InsightsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly reportQuery = new Subject<number | null>();
  private readonly schedules = inject(ScheduleService);
  private readonly suggestions = inject(DailySuggestionService);
  private readonly drafts = inject(ContentDraftService);
  private readonly publications = inject(PublicationService);
  private readonly router = inject(Router);
  readonly report = signal<PostingDistribution | null>(null);
  readonly selectedDays = signal<number | null>(30);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly suggestion = signal<DailyContentSuggestion | null>(null);
  readonly suggestionLoading = signal(false);
  readonly suggestionError = signal('');
  readonly suggestionMessage = signal('');
  readonly suggestionSaving = signal(false);
  readonly exportMessage = signal('');
  readonly recentPosts = signal<PublicationLog[]>([]);
  readonly recentPostsLoading = signal(true);
  readonly recentPostsError = signal('');
  readonly hours = Array.from({ length: 24 }, (_, hour) => hour);
  readonly days: DayBar[] = [
    { key: 'MONDAY', label: 'Lun' },
    { key: 'TUESDAY', label: 'Mar' },
    { key: 'WEDNESDAY', label: 'Mié' },
    { key: 'THURSDAY', label: 'Jue' },
    { key: 'FRIDAY', label: 'Vie' },
    { key: 'SATURDAY', label: 'Sáb' },
    { key: 'SUNDAY', label: 'Dom' },
  ];

  ngOnInit(): void {
    this.reportQuery.pipe(
      switchMap((days) => {
        this.loading.set(true);
        this.error.set('');
        this.exportMessage.set('');
        return this.schedules.getPostingDistribution(days).pipe(
          catchError((err: { error?: { message?: string } }) => {
            this.error.set(err.error?.message || 'No se pudo cargar el rendimiento registrado.');
            return of(null);
          }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((report) => {
      if (report) this.report.set(report);
    });
    this.load();
    this.loadRecentPosts();
  }

  loadRecentPosts(): void {
    this.recentPostsLoading.set(true);
    this.recentPostsError.set('');
    this.publications.getHistory(0, 5, { status: 'SUCCESS' })
      .pipe(
        finalize(() => this.recentPostsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (page) => this.recentPosts.set(page.content),
        error: () => this.recentPostsError.set('No pudimos cargar las publicaciones recientes.'),
      });
  }

  sourceLabel(source: PublicationLog['sourceMode'] | string): string {
    return ({ PROJECT: 'GitHub', RESEARCH: 'Investigación IA', BACKUP: 'Banco de ideas' })[source]
      ?? 'Origen no informado';
  }

  sourceEntries(): Array<[string, number]> {
    return Object.entries(this.report()?.postsBySource ?? {})
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }

  maxSourceCount(): number {
    return Math.max(1, ...this.sourceEntries().map(([, count]) => count));
  }

  load(days = this.selectedDays()): void {
    if (days !== null && ![7, 30, 90].includes(days)) {
      this.error.set('Selecciona 7, 30, 90 días o todo el historial.');
      return;
    }
    this.selectedDays.set(days);
    this.report.set(null);
    this.reportQuery.next(days);
  }

  changePeriod(value: string): void {
    if (value === 'all') {
      this.load(null);
      return;
    }
    if (value !== '7' && value !== '30' && value !== '90') {
      this.error.set('Selecciona 7, 30, 90 días o todo el historial.');
      return;
    }
    this.load(Number(value));
  }

  periodLabel(): string {
    const days = this.selectedDays();
    return days === null ? 'Todo el historial' : `Últimos ${days} días`;
  }

  exportCsv(): void {
    const data = this.report();
    if (!data) return;

    const blob = new Blob([buildPostingReportCsv(data, this.periodLabel())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `autopost-rendimiento-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.exportMessage.set('Informe CSV descargado con resultados y tokens registrados.');
  }

  generateSuggestion(): void {
    if (this.suggestionLoading() || this.suggestionSaving()) return;
    this.suggestionLoading.set(true);
    this.suggestionError.set('');
    this.suggestionMessage.set('');
    this.suggestions.generate()
      .pipe(finalize(() => this.suggestionLoading.set(false)))
      .subscribe({
        next: (result) => this.suggestion.set(result),
        error: (err: { error?: { message?: string } }) => {
          this.suggestionError.set(err.error?.message || 'No se pudo generar la sugerencia. Tus datos siguen intactos.');
        },
      });
  }

  saveSuggestionAsDraft(): void {
    const idea = this.suggestion();
    if (!idea || this.suggestionSaving() || this.suggestionLoading()) return;
    this.suggestionSaving.set(true);
    this.suggestionError.set('');
    this.suggestionMessage.set('');
    this.drafts.save({
      title: idea.title,
      text: idea.text,
      tone: 'PROFESSIONAL',
      audience: 'Profesionales interesados en los temas habituales de este espacio',
      goal: 'SHARE_LEARNING',
      instructions: idea.rationale,
      imageUrl: null,
      targetCredentialId: null,
    })
      .pipe(finalize(() => this.suggestionSaving.set(false)))
      .subscribe({
        next: (saved) => {
          this.suggestionMessage.set('Sugerencia guardada como borrador. Se abrirá en el editor para que la revises.');
          void this.router.navigate(['/compose'], { queryParams: { draft: saved.id } });
        },
        error: (err: { error?: { message?: string } }) => {
          this.suggestionError.set(err.error?.message || 'No se pudo guardar el borrador. La sugerencia sigue disponible para reintentar.');
        },
      });
  }

  hourCount(hour: number): number {
    return this.report()?.postsByHour?.[String(hour)] ?? 0;
  }

  dayCount(day: string): number {
    return this.report()?.postsByDayOfWeek?.[day] ?? 0;
  }

  hourLabel(hour: number): string {
    return `${String(hour).padStart(2, '0')}:00 · ${this.hourCount(hour)} publicaciones confirmadas`;
  }

  maxHourCount(): number {
    return Math.max(1, ...this.hours.map((hour) => this.hourCount(hour)));
  }

  maxDayCount(): number {
    return Math.max(1, ...this.days.map((day) => this.dayCount(day.key)));
  }

  modelEntries(): Array<[string, number]> {
    return Object.entries(this.report()?.tokensByModel ?? {}).sort((left, right) => right[1] - left[1]);
  }

  maxModelTokens(): number {
    return Math.max(1, ...this.modelEntries().map(([, tokens]) => tokens));
  }

  dailyTokenEntries(): Array<[string, number]> {
    return Object.entries(this.report()?.tokensByDay ?? {})
      .filter(([day, tokens]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(tokens) && tokens >= 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-14);
  }

  maxDailyTokens(): number {
    return Math.max(1, ...this.dailyTokenEntries().map(([, tokens]) => tokens));
  }

  usageDayLabel(day: string): string {
    const [year, month, date] = day.split('-').map(Number);
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' })
      .format(new Date(year, month - 1, date, 12));
  }

  barHeight(value: number, maximum: number): number {
    return value === 0 ? 0 : Math.max(8, Math.round(value / maximum * 100));
  }
}
