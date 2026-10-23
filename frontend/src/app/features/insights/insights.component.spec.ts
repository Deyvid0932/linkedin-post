import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ScheduleService, PostingDistribution } from '../../core/services/schedule.service';
import { DailySuggestionService } from '../../core/services/daily-suggestion.service';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { PublicationService } from '../../core/services/publication.service';
import { buildPostingReportCsv, InsightsComponent } from './insights.component';
import { Router } from '@angular/router';

describe('InsightsComponent', () => {
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const emptyReport: PostingDistribution = {
    postsByHour: Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [String(hour), 0])),
    postsByDayOfWeek: { MONDAY: 0, TUESDAY: 0, WEDNESDAY: 0, THURSDAY: 0, FRIDAY: 0, SATURDAY: 0, SUNDAY: 0 },
    totalPublishedPosts: 0,
    bestObservedHour: 'Sin datos',
    bestObservedDay: 'Sin datos',
    successfulPostsCount: 0,
    publicationsWithPublishedAtCount: 0,
    failedPostsCount: 0,
    postsBySource: { PROJECT: 0, RESEARCH: 0, BACKUP: 0 },
    successRatePercentage: null,
    recordedTokens: 0,
    tokensByModel: {},
    inputTokens: 0,
    outputTokens: 0,
    usageEvents: 0,
    tokensByDay: {},
  };
  let service: { getPostingDistribution: ReturnType<typeof vi.fn> };
  let suggestionService: { generate: ReturnType<typeof vi.fn> };
  let draftService: { save: ReturnType<typeof vi.fn> };
  let publicationService: { getHistory: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = { getPostingDistribution: vi.fn(() => of(emptyReport)) };
    suggestionService = { generate: vi.fn(() => of({
      title: 'Sugerencia', text: 'Un ángulo editorial nuevo', rationale: 'Basada en publicaciones reales',
      basedOnPublications: 2, bestObservedDay: 'MARTES', bestObservedHour: '08:00 hrs',
      generatedAt: '2026-10-17T13:00:00',
    })) };
    draftService = { save: vi.fn(() => of({ id: 'draft-suggestion' })) };
    publicationService = {
      getHistory: vi.fn(() => of({ content: [], totalElements: 0, totalPages: 0, size: 5, number: 0 })),
    };
    TestBed.configureTestingModule({
      imports: [InsightsComponent],
      providers: [
        provideRouter([]),
        { provide: ScheduleService, useValue: service },
        { provide: DailySuggestionService, useValue: suggestionService },
        { provide: ContentDraftService, useValue: draftService },
        { provide: PublicationService, useValue: publicationService },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('does not show an invented best time when there are no confirmed posts', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no hay un patrón confirmado');
    expect(fixture.nativeElement.textContent).not.toContain('08:00 hrs');
    const successRate = fixture.nativeElement.querySelectorAll('.metric-card')[2] as HTMLElement;
    expect(successRate.querySelector('strong')?.textContent?.trim()).toBe('—');
    expect(successRate.textContent).toContain('Sin intentos para calcular la tasa');
  });

  it('labels the AI suggestion as on demand instead of implying a scheduled daily result', () => {
    service.getPostingDistribution.mockReturnValue(of({
      ...emptyReport,
      successfulPostsCount: 1,
      totalPublishedPosts: 1,
    }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('SUGERENCIA BAJO DEMANDA');
    expect(fixture.nativeElement.textContent).not.toContain('IDEA PARA HOY');
  });

  it('shows the best time derived from confirmed publications', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    service.getPostingDistribution.mockReturnValue(of({
      ...emptyReport,
      totalPublishedPosts: 2,
      successfulPostsCount: 2,
      publicationsWithPublishedAtCount: 2,
      bestObservedHour: '08:00 hrs (Mañana)',
      bestObservedDay: 'MARTES',
      postsByHour: { ...emptyReport.postsByHour, '8': 2 },
      postsByDayOfWeek: { ...emptyReport.postsByDayOfWeek, TUESDAY: 2 },
    }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('MARTES · 08:00 hrs (Mañana)');
    expect(fixture.nativeElement.textContent).toContain('LinkedIn no ha proporcionado impresiones');
  });

  it('shows the recorded editorial origin counts without labeling them as social networks', () => {
    service.getPostingDistribution.mockReturnValue(of({
      ...emptyReport,
      successfulPostsCount: 3,
      totalPublishedPosts: 3,
      postsBySource: { PROJECT: 2, RESEARCH: 1, BACKUP: 0 },
    }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Publicaciones confirmadas por origen');
    expect(fixture.nativeElement.textContent).toContain('GitHub');
    expect(fixture.nativeElement.textContent).toContain('Investigación IA');
    expect(fixture.nativeElement.textContent).toContain('no representa redes sociales distintas');
    expect(fixture.componentInstance.sourceEntries()).toEqual([
      ['PROJECT', 2],
      ['RESEARCH', 1],
      ['BACKUP', 0],
    ]);
  });

  it('explains when successful posts have no confirmed publication timestamps', () => {
    service.getPostingDistribution.mockReturnValue(of({
      ...emptyReport,
      successfulPostsCount: 2,
      publicationsWithPublishedAtCount: 0,
    }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hay publicaciones exitosas, pero no tienen una fecha de publicación confirmada');
    expect(fixture.nativeElement.textContent).toContain('0 publicaciones con fecha confirmada');
    expect(fixture.componentInstance.hourCount(8)).toBe(0);
  });

  it('keeps a recoverable message when the report cannot be loaded', () => {
    service.getPostingDistribution.mockReturnValue(throwError(() => ({ error: { message: 'Sin conexión' } })));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
  });

  it('does not show metrics from the previous period after the new period fails to load', () => {
    service.getPostingDistribution.mockReturnValueOnce(of({
      ...emptyReport,
      successfulPostsCount: 4,
      totalPublishedPosts: 4,
    }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('4');

    service.getPostingDistribution.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'No se pudo cambiar el periodo' } })),
    );
    const period = fixture.nativeElement.querySelector(
      'select[aria-label="Periodo del informe"]',
    ) as HTMLSelectElement;
    period.value = '7';
    period.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.report()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Últimos 7 días');
    expect(fixture.nativeElement.textContent).toContain('No se pudo cambiar el periodo');
    expect(fixture.nativeElement.querySelector('.metric-grid')).toBeNull();
  });

  it('loads the selected reporting window from the API', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    expect(service.getPostingDistribution).toHaveBeenCalledWith(30);
    service.getPostingDistribution.mockClear();

    const period = fixture.nativeElement.querySelector('select[aria-label="Periodo del informe"]') as HTMLSelectElement;
    period.value = '7';
    period.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(service.getPostingDistribution).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.textContent).toContain('Últimos 7 días');
  });

  it('rejects unsupported periods without discarding the current report', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    service.getPostingDistribution.mockClear();
    const currentReport = fixture.componentInstance.report();

    fixture.componentInstance.changePeriod('14');

    expect(service.getPostingDistribution).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedDays()).toBe(30);
    expect(fixture.componentInstance.report()).toBe(currentReport);
    expect(fixture.componentInstance.error()).toContain('Selecciona 7, 30, 90 días');
  });

  it('keeps the loading state active when a period change cancels an older request', () => {
    const firstRequest = new Subject<PostingDistribution>();
    const nextRequest = new Subject<PostingDistribution>();
    service.getPostingDistribution
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(nextRequest);
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading()).toBe(true);

    const period = fixture.nativeElement.querySelector(
      'select[aria-label="Periodo del informe"]',
    ) as HTMLSelectElement;
    period.value = '7';
    period.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(true);
  });

  it('shows recent successful publications from the real history without invented reach data', () => {
    publicationService.getHistory.mockReturnValue(of({
      content: [{
        id: 'pub-1', sourceMode: 'PROJECT', status: 'SUCCESS',
        generatedText: 'Lecciones reales de una migración gradual con Spring Boot.',
        createdAt: '2026-10-15T12:00:00Z', publishedAt: '2026-10-15T12:05:00Z',
      }],
      totalElements: 1, totalPages: 1, size: 5, number: 0,
    }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(publicationService.getHistory).toHaveBeenCalledWith(0, 5, { status: 'SUCCESS' });
    expect(fixture.nativeElement.textContent).toContain('Lecciones reales de una migración gradual');
    expect(fixture.nativeElement.textContent).toContain('GitHub');
    expect(fixture.nativeElement.textContent).toContain('Publicada');
    expect(fixture.nativeElement.textContent).not.toContain('Impresiones');
  });

  it('keeps recent publication history retryable when that source is unavailable', () => {
    publicationService.getHistory.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las publicaciones recientes');
    expect(fixture.nativeElement.textContent).not.toContain('Todavía no hay publicaciones confirmadas');
  });

  it('exports recorded metrics and escapes spreadsheet formulas in model names', () => {
    const csv = buildPostingReportCsv({
      ...emptyReport,
      successfulPostsCount: 3,
      failedPostsCount: 1,
      successRatePercentage: 75,
      recordedTokens: 240,
      tokensByModel: { '=HYPERLINK("https://example.test")': 240 },
      tokensByDay: { '2026-10-16': 240 },
      postsByHour: { ...emptyReport.postsByHour, '8': 3 },
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Resumen","Publicaciones confirmadas","3"');
    expect(csv).toContain('"Resumen","Publicaciones con fecha confirmada","0"');
    expect(buildPostingReportCsv(emptyReport)).toContain('"Resumen","Tasa de éxito (%)","Sin datos"');
    expect(csv).toContain('"Tokens por modelo","\'=HYPERLINK(""https://example.test"")","240"');
    expect(csv).toContain('"Tokens de texto por día","2026-10-16","240"');
    expect(csv).toContain('"Publicaciones por hora","08:00","3"');
  });

  it('shows daily token usage from provider-reported aggregates and limits the chart to recent dates', () => {
    const tokensByDay = Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => {
        const day = new Date(2026, 9, index + 1, 12).toISOString().slice(0, 10);
        return [day, (index + 1) * 100];
      }),
    );
    service.getPostingDistribution.mockReturnValue(of({ ...emptyReport, tokensByDay }));
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Consumo diario de texto');
    expect(fixture.componentInstance.dailyTokenEntries()).toHaveLength(14);
    expect(fixture.componentInstance.dailyTokenEntries()[0][1]).toBe(300);
    expect(fixture.componentInstance.maxDailyTokens()).toBe(1600);
    expect(fixture.nativeElement.textContent).toContain('1,600');
  });

  it('downloads the report only after a report is available', () => {
    const createObjectURL = vi.fn(() => 'blob:autopost-report');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    let downloadedAs = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedAs = this.download;
    });
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    fixture.componentInstance.report.set(null);

    fixture.componentInstance.exportCsv();
    expect(createObjectURL).not.toHaveBeenCalled();

    fixture.componentInstance.report.set({ ...emptyReport, recordedTokens: 120 });
    fixture.componentInstance.exportCsv();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloadedAs).toMatch(/^autopost-rendimiento-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(fixture.componentInstance.exportMessage()).toContain('CSV descargado');
  });

  it('generates an AI suggestion only after an explicit user action', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();

    expect(suggestionService.generate).not.toHaveBeenCalled();
    fixture.componentInstance.generateSuggestion();

    expect(suggestionService.generate).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.suggestion()?.text).toBe('Un ángulo editorial nuevo');
  });

  it('saves a suggestion as an editable draft and opens the editor without approving it', () => {
    const fixture = TestBed.createComponent(InsightsComponent);
    fixture.detectChanges();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.suggestion.set({
      title: 'Sugerencia', text: 'Un ángulo editorial nuevo', rationale: 'Basada en publicaciones reales',
      basedOnPublications: 2, bestObservedDay: 'MARTES', bestObservedHour: '08:00 hrs',
      generatedAt: '2026-10-17T13:00:00',
    });

    fixture.componentInstance.saveSuggestionAsDraft();

    expect(draftService.save).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Un ángulo editorial nuevo', goal: 'SHARE_LEARNING', targetCredentialId: null,
    }));
    expect(navigate).toHaveBeenCalledWith(['/compose'], { queryParams: { draft: 'draft-suggestion' } });
  });
});
