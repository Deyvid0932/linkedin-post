import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { AdminOverview, AdminService } from '../../core/services/admin.service';
import { AdminComponent } from './admin.component';
import { AdminOverviewComponent } from './admin-overview.component';

describe('AdminComponent audit pagination', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AdminComponent>>;
  let api: {
    getOverview: ReturnType<typeof vi.fn>;
    getApiQuotaPolicy: ReturnType<typeof vi.fn>;
    getPublicationApprovalPolicy: ReturnType<typeof vi.fn>;
    updatePublicationApprovalPolicy: ReturnType<typeof vi.fn>;
    getAuditEvents: ReturnType<typeof vi.fn>;
    getUsers: ReturnType<typeof vi.fn>;
    getInvitations: ReturnType<typeof vi.fn>;
    createInvitation: ReturnType<typeof vi.fn>;
    revokeInvitation: ReturnType<typeof vi.fn>;
    setUserActive: ReturnType<typeof vi.fn>;
    setUserRoles: ReturnType<typeof vi.fn>;
    updateUserAiQuota: ReturnType<typeof vi.fn>;
    updateApiQuotaPolicy: ReturnType<typeof vi.fn>;
    getTenantAiQuotas: ReturnType<typeof vi.fn>;
    updateTenantAiQuota: ReturnType<typeof vi.fn>;
  };
  const overviewComponent = (): AdminOverviewComponent => fixture.debugElement
    .query(By.directive(AdminOverviewComponent)).componentInstance as AdminOverviewComponent;

  beforeEach(() => {
    api = {
      getOverview: vi.fn((periodDays = 30) => of({
        totalUsers: 0,
        activeUsers: 0,
        totalWorkspaces: 0,
        publishedPosts: 0,
        failedPosts: 0,
        periodDays,
        apiRequestMetricsStartedOn: '2026-10-16',
        apiRequestsToday: 4,
        successfulApiRequestsToday: 2,
        redirectedApiRequestsToday: 0,
        clientErrorApiRequestsToday: 1,
        serverErrorApiRequestsToday: 1,
        dailyApiRequests: [
          { date: '2026-10-16', tracked: true, successful: 4, redirects: 0, clientErrors: 1, serverErrors: 0 },
          { date: '2026-10-17', tracked: true, successful: 2, redirects: 1, clientErrors: 0, serverErrors: 1 },
        ],
        recordedTokensInPeriod: 150,
        reportedTextRequestsInPeriod: 3,
        successfulImageGenerationsInPeriod: 2,
        imageMetricsStartedOn: '2026-10-16',
        http429ResponsesInPeriod: 4,
        http429MetricsStartedOn: '2026-10-16',
        http429ResponsesByRouteGroupInPeriod: { auth: 1, ai: 2, api: 1 },
        dailyHttp429Responses: [
          { date: '2026-10-16', tracked: true, auth: 0, ai: 1, api: 0 },
          { date: '2026-10-17', tracked: true, auth: 1, ai: 1, api: 1 },
        ],
        textMetricsStartedOn: '2026-10-16',
        dailyReportedTextTokens: [
          { date: '2026-10-15', tracked: false, tokens: 0 },
          { date: '2026-10-16', tracked: true, tokens: 100 },
          { date: '2026-10-17', tracked: true, tokens: 50 },
        ],
        dailyImageGenerations: [
          { date: '2026-10-16', tracked: true, successfulGenerations: 1 },
          { date: '2026-10-17', tracked: true, successfulGenerations: 1 },
        ],
        dailyPublicationOutcomes: [
          { date: '2026-10-16', published: 2, failed: 0 },
          { date: '2026-10-17', published: 0, failed: 1 },
        ],
        textUsageByModel: [{
          provider: 'NanoGPT', model: 'text-model', requestCount: 3,
          inputTokens: 120, outputTokens: 80, totalTokens: 200,
        }],
      })),
      getApiQuotaPolicy: vi.fn(() => of({
        authRequestsPerMinute: 20,
        aiRequestsPerMinute: 10,
        apiRequestsPerMinute: 120,
        updatedAt: '2026-10-17T12:00:00',
      })),
      getPublicationApprovalPolicy: vi.fn(() => of({ approvalRequired: false, updatedAt: '2026-10-17T12:00:00' })),
      updatePublicationApprovalPolicy: vi.fn((approvalRequired: boolean) => of({ approvalRequired, updatedAt: '2026-10-17T12:30:00' })),
      getAuditEvents: vi.fn((page = 0) => of({
        content: [],
        number: page,
        totalElements: 21,
        totalPages: 2,
      })),
      getUsers: vi.fn(() => of({ content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 })),
      getInvitations: vi.fn((page = 0) => of({ content: [], number: page, size: 20, totalElements: 0, totalPages: 0 })),
      createInvitation: vi.fn(() => of({ id: 'invite-1', email: 'invite@example.com', invitationUrl: 'http://localhost:4200/auth/accept-invitation#token=sample', expiresAt: '2026-10-20T12:00:00' })),
      revokeInvitation: vi.fn(() => of({})),
      setUserActive: vi.fn(() => of({})),
      setUserRoles: vi.fn((_userId: string, roles: string[]) => of({
        id: 'target-user', tenantId: 'tenant-1', name: 'Usuario de prueba', email: 'user@example.com',
        active: true, roles, createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null, aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 10,
      })),
      updateUserAiQuota: vi.fn((userId: string, requestsPerMinute: number | null, expiresAt: string | null) => of({
        id: userId, tenantId: 'tenant-1', name: 'Usuario de prueba', email: 'user@example.com', active: true,
        roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: requestsPerMinute,
        aiRequestsPerMinuteExpiresAt: expiresAt,
        effectiveAiRequestsPerMinute: requestsPerMinute ?? 10,
      })),
      updateApiQuotaPolicy: vi.fn(() => of({})),
      getTenantAiQuotas: vi.fn((page = 0) => of({
        content: [{ tenantId: 'tenant-1', primaryEmail: 'user@example.com', accountCount: 2, overrideRequestsPerMinute: null, overrideExpiresAt: null, effectiveRequestsPerMinute: 10 }],
        number: page,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      })),
      updateTenantAiQuota: vi.fn((_tenantId: string, requestsPerMinute: number | null, expiresAt: string | null) => of({
        tenantId: 'tenant-1', primaryEmail: 'user@example.com', accountCount: 2,
        overrideRequestsPerMinute: requestsPerMinute, overrideExpiresAt: expiresAt, effectiveRequestsPerMinute: requestsPerMinute ?? 10,
      })),
    };

    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [{ provide: AdminService, useValue: api }],
    });
    fixture = TestBed.createComponent(AdminComponent);
    fixture.detectChanges();
  });

  it('renders reported daily AI usage and scales the chart from observed values', () => {
    fixture.detectChanges();
    const bars = fixture.nativeElement.querySelectorAll('.usage-bar') as NodeListOf<HTMLElement>;
    expect(bars.length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('.usage-bar--untracked').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.usage-bar--untracked')?.getAttribute('title'))
      .toContain('sin registro');
    const textUsagePanel = fixture.nativeElement.querySelector('#admin-usage-title')?.closest('section') as HTMLElement;
    expect(textUsagePanel.querySelector('ul.sr-only')?.textContent).toContain('sin registro de métricas');
    expect(fixture.nativeElement.textContent).toContain('Tokens de texto informados por los proveedores');
    expect(fixture.nativeElement.textContent).toContain('3 solicitudes con tokens reportados');
    expect(fixture.nativeElement.textContent).toContain('Generaciones de imagen con NanoGPT');
    expect(fixture.nativeElement.textContent).toContain('El histórico de imágenes empieza el 2026-10-16');
    expect(fixture.nativeElement.textContent).toContain('4');
    expect(fixture.nativeElement.textContent).toContain('respuestas HTTP 429');
    expect(fixture.nativeElement.querySelector('.response-breakdown')?.getAttribute('aria-label'))
      .toBe('Desglose por tipo de ruta');
    expect(fixture.nativeElement.querySelector('.response-breakdown')?.textContent).toContain('Autenticación 1');
    expect(fixture.nativeElement.querySelector('.response-breakdown')?.textContent).toContain('IA 2');
    expect(fixture.nativeElement.querySelector('.response-breakdown')?.textContent).toContain('API 1');
    expect(fixture.nativeElement.textContent).toContain('Tendencia de respuestas HTTP 429');
    expect(fixture.nativeElement.textContent).toContain('Solicitudes API hoy');
    expect(fixture.nativeElement.textContent).toContain('Registro desde 2026-10-16');
    expect(fixture.nativeElement.querySelectorAll('.api-request-day').length).toBe(2);
    expect(fixture.nativeElement.querySelector('#admin-api-request-title')?.closest('section')?.textContent)
      .toContain('6 correctas');
    expect(fixture.nativeElement.textContent).toContain('por sí solo no demuestra un ataque');
    expect(fixture.nativeElement.querySelector('.publication-history')?.textContent).toContain('Histórico completo');
    expect(fixture.nativeElement.textContent).toContain('el periodo aplica a estas tendencias');
    const throttleChart = fixture.nativeElement.querySelector('.throttle-chart') as HTMLElement;
    expect(throttleChart.getAttribute('aria-label')).toContain('1 de autenticación, 2 de IA y 1 de API');
    expect(fixture.nativeElement.querySelector('.throttle-panel ul.sr-only')?.textContent)
      .toContain('2026-10-17: 1 de autenticación, 1 de IA y 1 de API');
    expect(overviewComponent().throttleBarHeight(1, [
      { date: '2026-10-16', tracked: true, auth: 0, ai: 1, api: 0 },
      { date: '2026-10-17', tracked: true, auth: 1, ai: 1, api: 1 },
      { date: '2026-10-18', tracked: false, auth: 200, ai: 100, api: 100 },
    ])).toBe(33.33333333333333);
    expect(overviewComponent().throttleTrendTotals([
      { date: '2026-10-16', tracked: true, auth: 0, ai: 1, api: 0 },
      { date: '2026-10-17', tracked: true, auth: 1, ai: 1, api: 1 },
      { date: '2026-10-18', tracked: false, auth: 200, ai: 100, api: 100 },
    ])).toEqual({ auth: 1, ai: 2, api: 1 });
    expect(overviewComponent().throttleTrendLabel([
      { date: '2026-10-16', tracked: true, auth: 1, ai: 0, api: 0 },
      { date: '2026-10-17', tracked: false, auth: 0, ai: 0, api: 0 },
    ])).toContain('1 día sin registro disponible');
    expect(fixture.nativeElement.textContent).toContain('AutoPost no estima costos');
    expect(fixture.nativeElement.querySelectorAll('.usage-axis').length).toBe(4);
    const modelUsagePanel = fixture.nativeElement.querySelector('#admin-model-usage-title')?.closest('section') as HTMLElement;
    expect(modelUsagePanel.textContent).toContain('NanoGPT');
    expect(modelUsagePanel.textContent).toContain('text-model');
    expect(modelUsagePanel.textContent).toContain('120');
    expect(modelUsagePanel.textContent).toContain('80');
    expect(modelUsagePanel.textContent).toContain('200');
    expect(overviewComponent().usageBarHeight(50, [
      { date: '2026-10-16', tracked: true, tokens: 100 },
      { date: '2026-10-17', tracked: true, tokens: 50 },
    ])).toBe(50);
    expect(overviewComponent().usageBarHeight(0, [
      { date: '2026-10-16', tracked: true, tokens: 0 },
    ])).toBe(0);
    expect(overviewComponent().hasTrackedTextUsage([
      { date: '2026-10-16', tracked: false, tokens: 0 },
      { date: '2026-10-17', tracked: true, tokens: 0 },
    ])).toBe(true);
    expect(overviewComponent().hasTrackedTextUsage([
      { date: '2026-10-16', tracked: false, tokens: 0 },
    ])).toBe(false);
    expect(overviewComponent().imageUsageBarHeight(1, [
      { date: '2026-10-16', tracked: true, successfulGenerations: 2 },
      { date: '2026-10-17', tracked: false, successfulGenerations: 100 },
    ])).toBe(50);
    expect(overviewComponent().hasTrackedImageGenerations([
      { date: '2026-10-16', tracked: false, successfulGenerations: 0 },
    ])).toBe(false);
    expect(overviewComponent().usageDayLabel('2026-10-17')).toBe('17/10');
    const publicationPanel = fixture.nativeElement.querySelector('#admin-publication-trend-title')?.closest('section') as HTMLElement;
    expect(publicationPanel.querySelectorAll('.publication-day').length).toBe(2);
    expect(publicationPanel.querySelector('.publication-legend')?.textContent).toContain('2 confirmadas');
    expect(publicationPanel.querySelector('.publication-legend')?.textContent).toContain('1 fallidas');
    expect(publicationPanel.querySelector('ul.sr-only')?.textContent).toContain('2 confirmadas, 0 fallidas');
    expect(overviewComponent().publicationBarHeight(1, [
      { date: '2026-10-16', published: 2, failed: 0 },
      { date: '2026-10-17', published: 0, failed: 1 },
    ])).toBe(50);
    expect(overviewComponent().apiRequestBarHeight(2, [
      { date: '2026-10-16', tracked: true, successful: 4, redirects: 0, clientErrors: 1, serverErrors: 0 },
      { date: '2026-10-17', tracked: true, successful: 2, redirects: 1, clientErrors: 0, serverErrors: 1 },
    ])).toBe(40);
    expect(overviewComponent().apiRequestTrendTotals([
      { date: '2026-10-16', tracked: true, successful: 4, redirects: 0, clientErrors: 1, serverErrors: 0 },
      { date: '2026-10-17', tracked: false, successful: 100, redirects: 0, clientErrors: 0, serverErrors: 0 },
    ])).toEqual({ successful: 4, redirects: 0, clientErrors: 1, serverErrors: 0 });
    expect(overviewComponent().hasTrackedApiRequests([
      { date: '2026-10-16', tracked: false, successful: 0, redirects: 0, clientErrors: 0, serverErrors: 0 },
    ])).toBe(false);
    expect(overviewComponent().publicationTrendLabel([
      { date: '2026-10-16', published: 2, failed: 0 },
      { date: '2026-10-17', published: 0, failed: 1 },
    ])).toContain('2 confirmadas y 1 fallidas');
    expect(overviewComponent().publicationTrendTotals([
      { date: '2026-10-16', published: 2, failed: 0 },
      { date: '2026-10-17', published: 0, failed: 1 },
      { date: '2026-10-18', published: Number.NaN, failed: -3 },
    ])).toEqual({ published: 2, failed: 1 });
  });

  it('requests and labels the selected metrics period', () => {
    const weekButton = [...fixture.nativeElement.querySelectorAll('.period-picker button')]
      .find((button) => button.textContent?.trim() === '7 días') as HTMLButtonElement;
    weekButton.click();
    fixture.detectChanges();

    expect(api.getOverview).toHaveBeenLastCalledWith(7);
    expect(overviewComponent().periodDays()).toBe(7);
    expect(fixture.nativeElement.querySelector('.period-picker button[aria-pressed="true"]')?.textContent)
      .toContain('7 días');
    expect(fixture.nativeElement.querySelector('#admin-usage-title')?.parentElement?.textContent)
      .toContain('últimos 7 días');
    expect(fixture.nativeElement.querySelector('#admin-publication-trend-title')?.parentElement?.textContent)
      .toContain('últimos 7 días');
    expect(fixture.nativeElement.querySelector('.usage-axis')?.textContent).toContain('Hace 6 días');
    expect((fixture.nativeElement.querySelector('.admin-trends') as HTMLElement).style
      .getPropertyValue('--admin-period-days')).toBe('7');
  });

  it('keeps the last loaded metrics visible while a new period is loading', () => {
    const pendingResponse = new Subject<AdminOverview>();
    api.getOverview.mockReturnValueOnce(pendingResponse.asObservable());
    const component = overviewComponent();
    const previous = component.overview()!;

    component.setPeriod(7);
    fixture.detectChanges();

    expect(component.overview()).toBe(previous);
    expect(fixture.nativeElement.querySelector('.overview-refresh')?.textContent)
      .toContain('últimos 30 días');
    expect(fixture.nativeElement.querySelector('.admin-trends')?.getAttribute('aria-busy'))
      .toBe('true');

    pendingResponse.next({ ...previous, periodDays: 7 });
    pendingResponse.complete();
    fixture.detectChanges();

    expect(component.overview()?.periodDays).toBe(7);
    expect(fixture.nativeElement.querySelector('.overview-refresh')).toBeNull();
    expect(fixture.nativeElement.querySelector('.admin-trends')?.getAttribute('aria-busy'))
      .toBe('false');
  });

  it('shows an explicit empty state when the selected period has no publication outcomes', () => {
    const previous = overviewComponent().overview()!;
    api.getOverview.mockReturnValueOnce(of({
      ...previous,
      periodDays: 7,
      dailyPublicationOutcomes: Array.from({ length: 7 }, (_, index) => ({
        date: `2026-10-${String(11 + index).padStart(2, '0')}`,
        published: 0,
        failed: 0,
      })),
    }));

    overviewComponent().setPeriod(7);
    fixture.detectChanges();

    const publicationPanel = fixture.nativeElement.querySelector('#admin-publication-trend-title')
      ?.closest('section') as HTMLElement;
    expect(publicationPanel.querySelector('.publication-bars')).toBeNull();
    expect(publicationPanel.querySelector('[role="status"]')?.textContent)
      .toContain('No se registraron publicaciones confirmadas ni fallidas en los últimos 7 días');
  });

  it('derives admin rates from real totals and omits rates without a denominator', () => {
    const component = overviewComponent();
    expect(component.activeAccountPercentage(8, 10)).toBe(80);
    expect(component.activeAccountPercentage(0, 0)).toBeNull();
    expect(component.activeAccountPercentage(11, 10)).toBeNull();
    expect(component.failedPublicationPercentage(2, 8)).toBe(20);
    expect(component.failedPublicationPercentage(0, 0)).toBeNull();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin cuentas para calcular el porcentaje');
    expect(fixture.nativeElement.querySelector('.publication-history')?.textContent).toContain('0 confirmadas · 0 fallidas');
    expect(fixture.nativeElement.querySelector('.stat-progress')).toBeNull();

    const overview = component.overview()!;
    component.overview.set({ ...overview, totalUsers: 10, activeUsers: 8, publishedPosts: 8, failedPosts: 2 });
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.stat-card') as NodeListOf<HTMLElement>;
    expect(cards[0].textContent).toContain('80% de cuentas activas');
    expect(fixture.nativeElement.querySelector('.publication-history')?.textContent)
      .toContain('20% de resultados fallidos');
    expect(cards[0].querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('80');
    expect((cards[0].querySelector('.stat-progress > span') as HTMLElement).style.width).toBe('80%');
  });

  it('keeps the last real metrics visible when refresh fails and allows retry', () => {
    const component = overviewComponent();
    const originalOverview = component.overview();
    api.getOverview.mockImplementationOnce(() => throwError(() => ({
      error: { message: 'El servicio de métricas no está disponible.' },
    })));

    component.load();
    fixture.detectChanges();

    expect(component.overview()).toBe(originalOverview);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('El servicio de métricas no está disponible.');
    expect(fixture.nativeElement.querySelector('.publication-history')?.textContent).toContain('Histórico completo');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Reintentar');

    component.load();
    fixture.detectChanges();
    expect(component.overview()?.recordedTokensInPeriod).toBe(150);
    expect(component.error()).toBe('');
  });

  it('does not render unobserved days as zero HTTP 429 responses', () => {
    const component = overviewComponent();
    const current = component.overview()!;
    component.overview.set({
      ...current,
      http429ResponsesInPeriod: 0,
      http429MetricsStartedOn: '2026-10-18',
      dailyHttp429Responses: [
        { date: '2026-10-16', tracked: false, auth: 0, ai: 0, api: 0 },
        { date: '2026-10-17', tracked: false, auth: 0, ai: 0, api: 0 },
      ],
    });
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.throttle-panel') as HTMLElement;
    expect(panel.querySelector('.throttle-empty')?.textContent).toContain('No hay días observados');
    expect(panel.querySelector('.throttle-chart')).toBeNull();
  });

  it('refreshes the overview after an account access status changes', () => {
    const component = fixture.componentInstance;
    const user = {
      id: 'target-user', tenantId: 'tenant-1', name: 'Usuario', email: 'user@example.com', active: true,
      roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null,
      aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 10,
    };
    const initialOverviewLoads = api.getOverview.mock.calls.length;

    component.requestStatusChange(user);
    component.confirmStatusChange();

    expect(api.setUserActive).toHaveBeenCalledWith('target-user', false);
    expect(api.getOverview).toHaveBeenCalledTimes(initialOverviewLoads + 1);
  });

  it('loads the first audit page and fetches the next page on demand', () => {
    const auditSection = fixture.nativeElement.querySelectorAll('.admin-section-nav button')[4] as HTMLButtonElement;
    auditSection.click();
    fixture.detectChanges();

    expect(api.getAuditEvents).toHaveBeenCalledWith(0);
    const footer = fixture.nativeElement.querySelector(
      'footer[aria-label="Paginación de auditoría"]',
    ) as HTMLElement;
    expect(footer.textContent).toContain('21 eventos · Página 1 de 2');

    const next = footer.querySelectorAll('button')[1];
    next.click();
    fixture.detectChanges();

    expect(api.getAuditEvents).toHaveBeenLastCalledWith(1);
    expect(footer.textContent).toContain('Página 2 de 2');
    expect((footer.querySelectorAll('button')[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves a workspace override and can return that workspace to the global limit', () => {
    const quotasSection = fixture.nativeElement.querySelectorAll('.admin-section-nav button')[3] as HTMLButtonElement;
    quotasSection.click();
    fixture.detectChanges();

    expect(api.getTenantAiQuotas).toHaveBeenCalledWith(0);
    const input = fixture.nativeElement.querySelector('#tenant-quota-tenant-1') as HTMLInputElement;
    const save = fixture.nativeElement.querySelector('.tenant-quota-panel tbody button') as HTMLButtonElement;
    input.value = '18';
    input.dispatchEvent(new Event('input'));
    save.click();
    fixture.detectChanges();
    expect(api.updateTenantAiQuota).toHaveBeenLastCalledWith('tenant-1', 18, null);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    save.click();
    fixture.detectChanges();
    expect(api.updateTenantAiQuota).toHaveBeenLastCalledWith('tenant-1', null, null);
  });

  it('stores a workspace override with its selected local expiry converted to an instant', () => {
    const quotasSection = fixture.nativeElement.querySelectorAll('.admin-section-nav button')[3] as HTMLButtonElement;
    quotasSection.click();
    fixture.detectChanges();
    const selected = new Date(Math.ceil((Date.now() + 60 * 60_000) / 60_000) * 60_000);
    const localValue = new Date(selected.getTime() - selected.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    const limit = fixture.nativeElement.querySelector('#tenant-quota-tenant-1') as HTMLInputElement;
    const expiry = fixture.nativeElement.querySelector('#tenant-quota-expiry-tenant-1') as HTMLInputElement;
    limit.value = '15';
    limit.dispatchEvent(new Event('input'));
    expiry.value = localValue;
    expiry.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.tenant-quota-panel tbody button') as HTMLButtonElement).click();

    expect(api.updateTenantAiQuota).toHaveBeenLastCalledWith('tenant-1', 15, selected.toISOString());
  });

  it('lets an administrator require approval globally and confirms the saved policy', () => {
    const quotasSection = fixture.nativeElement.querySelectorAll('.admin-section-nav button')[3] as HTMLButtonElement;
    quotasSection.click();
    fixture.detectChanges();
    expect(api.getPublicationApprovalPolicy).toHaveBeenCalled();
    const toggle = fixture.nativeElement.querySelector('#publication-policy-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(api.updatePublicationApprovalPolicy).toHaveBeenCalledWith(true);
    expect(fixture.nativeElement.textContent).toContain('Aprobación obligatoria');
  });

  it('submits selected roles and refreshes the account list', () => {
    const user = {
      id: 'target-user', tenantId: 'tenant-1', name: 'Usuario de prueba', email: 'user@example.com',
      active: true, roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null, aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 10,
    };
    fixture.componentInstance.requestRoleChange(user);
    fixture.componentInstance.toggleRole('ROLE_ADMIN', true);
    fixture.componentInstance.confirmRoleChange();

    expect(api.setUserRoles).toHaveBeenCalledWith('target-user', expect.arrayContaining(['ROLE_USER', 'ROLE_ADMIN']));
    expect(fixture.componentInstance.rolesSuccess()).toContain('iniciar sesión de nuevo');
  });

  it('saves a personal AI request override and restores inheritance when cleared', () => {
    fixture.componentInstance.setUserAiQuotaDraft('target-user', '4');
    fixture.componentInstance.saveUserAiQuota({
      id: 'target-user', tenantId: 'tenant-1', name: 'Usuario', email: 'user@example.com', active: true,
      roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null, aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 10,
    });
    expect(api.updateUserAiQuota).toHaveBeenLastCalledWith('target-user', 4, null);
    expect(fixture.componentInstance.userAiQuotaSuccess()).toContain('Límite personal');

    fixture.componentInstance.setUserAiQuotaDraft('target-user', '');
    fixture.componentInstance.saveUserAiQuota({
      id: 'target-user', tenantId: 'tenant-1', name: 'Usuario', email: 'user@example.com', active: true,
      roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: 4, aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 4,
    });
    expect(api.updateUserAiQuota).toHaveBeenLastCalledWith('target-user', null, null);
    expect(fixture.componentInstance.userAiQuotaSuccess()).toContain('hereda');
  });

  it('shows the effective AI cap and lets an administrator save it from the account list', () => {
    fixture.componentInstance.users.set({
      content: [{
        id: 'target-user', tenantId: 'tenant-1', name: 'Usuario', email: 'user@example.com', active: true,
        roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null, aiRequestsPerMinuteExpiresAt: null,
        effectiveAiRequestsPerMinute: 10,
      }], number: 0, size: 20, totalElements: 1, totalPages: 1,
    });
    fixture.componentInstance.activeSection.set('users');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Efectivo: 10/min');
    const input = fixture.nativeElement.querySelector('#user-ai-quota-target-user') as HTMLInputElement;
    input.value = '6';
    input.dispatchEvent(new Event('input'));
    const save = fixture.nativeElement.querySelector('.user-quota-control button') as HTMLButtonElement;
    save.click();
    fixture.detectChanges();
    expect(api.updateUserAiQuota).toHaveBeenCalledWith('target-user', 6, null);
  });

  it('sends a temporary user quota as an ISO instant', () => {
    const component = fixture.componentInstance;
    const selected = new Date(Math.ceil((Date.now() + 60 * 60_000) / 60_000) * 60_000);
    const localValue = new Date(selected.getTime() - selected.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    component.setUserAiQuotaDraft('target-user', '6');
    component.setUserAiQuotaExpiryDraft('target-user', localValue);
    component.saveUserAiQuota({
      id: 'target-user', tenantId: 'tenant-1', name: 'Usuario', email: 'user@example.com', active: true,
      roles: ['ROLE_USER'], createdAt: '2026-10-17T12:00:00', aiRequestsPerMinute: null,
      aiRequestsPerMinuteExpiresAt: null, effectiveAiRequestsPerMinute: 10,
    });

    expect(api.updateUserAiQuota).toHaveBeenLastCalledWith('target-user', 6, selected.toISOString());
  });

  it('creates a one-time invitation and loads the invitation history', () => {
    const invitationsSection = fixture.nativeElement.querySelectorAll('.admin-section-nav button')[2] as HTMLButtonElement;
    invitationsSection.click();
    fixture.detectChanges();

    const email = fixture.nativeElement.querySelector('#invite-email') as HTMLInputElement;
    email.value = ' invite@example.com ';
    email.dispatchEvent(new Event('input'));
    const form = fixture.nativeElement.querySelector('.invite-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.getInvitations).toHaveBeenCalledWith(0);
    expect(api.createInvitation).toHaveBeenCalledWith('invite@example.com');
    expect((fixture.nativeElement.querySelector('#invite-link') as HTMLInputElement).value).toContain('#token=sample');
    expect(fixture.nativeElement.textContent).toContain('El enlace se muestra solo ahora');
  });
});
