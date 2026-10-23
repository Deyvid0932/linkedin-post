import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AutomationStateService } from '../../core/services/automation-state.service';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { PublicationService } from '../../core/services/publication.service';
import { TenantService } from '../../core/services/tenant.service';
import { TopicService } from '../../core/services/topic.service';
import { DashboardComponent } from './dashboard.component';
import { Schedule, ScheduleService } from '../../core/services/schedule.service';

describe('DashboardComponent', () => {
  function setup(topicResponse = of([{ id: '1' }, { id: '2' }]), scheduleResponse: Observable<Schedule[]> = of([])) {
    const tenant = { getProfile: vi.fn(() => of({ timezone: 'America/Lima' })), getDashboardStats: vi.fn(() => of({
      totalPublications: 9, successCount: 7, failedCount: 2, activeSchedules: 1,
      linkedInConnected: true, linkedInDaysRemaining: 40,
    })) };
    const publications = {
      getQueue: vi.fn(() => of([{ id: 'queued-1', status: 'PENDING', generatedText: 'Pendiente', createdAt: '2026-10-17' }])),
      getHistory: vi.fn(() => of({ content: [], totalElements: 0, totalPages: 0, size: 4, number: 0 })),
    };
    const drafts = { list: vi.fn(() => of([
      { id: 'draft-1', queued: false }, { id: 'queued-draft', queued: true },
    ])) };
    const topics = { getTopics: vi.fn(() => topicResponse) };
    const automation = {
      enabled: signal(false), label: signal('Publicación pausada'),
      explanation: 'Estado de automatización.', load: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: TenantService, useValue: tenant },
        { provide: PublicationService, useValue: publications },
        { provide: ContentDraftService, useValue: drafts },
        { provide: TopicService, useValue: topics },
        { provide: ScheduleService, useValue: { getSchedules: () => scheduleResponse } },
        { provide: AutomationStateService, useValue: automation },
        { provide: AuthService, useValue: { currentUserSignal: signal({ name: 'Deyvid Silva' }) } },
      ],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { fixture, tenant, publications, drafts, topics };
  }

  it('shows counts from APIs and excludes drafts already in the publication queue', () => {
    const { fixture } = setup();
    const values = Array.from(
      fixture.nativeElement.querySelectorAll('.dashboard-metric strong') as NodeListOf<HTMLElement>,
    ).map((node) => node.textContent?.trim());

    expect(values).toEqual(['7', '1', '2', '1']);
  });

  it('marks a failed metric source unavailable instead of displaying a false zero', () => {
    const { fixture } = setup(throwError(() => new Error('topics unavailable')));
    const ideasMetric = fixture.nativeElement.querySelectorAll('.dashboard-metric')[2] as HTMLElement;

    expect(ideasMetric.textContent).toContain('No disponible');
    expect(ideasMetric.textContent).not.toContain('0');
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el conteo de ideas.');
  });

  it('marks only recognized recurring days and does not invent a publication date', () => {
    const {fixture} = setup(undefined, of([
      {id:'known',cronExpression:'0 0 8 ? * MON,WED,FRI',isActive:true,description:'Horario',createdAt:'2026-10-01'},
      {id:'custom',cronExpression:'0 0 9 ? * TUE',isActive:true,description:'Personalizado',createdAt:'2026-10-01'},
    ]));
    expect([...fixture.componentInstance.activeDays()]).toEqual([0,2,4]);
    expect(fixture.componentInstance.customSchedules()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Sin fecha individual asignada');
    expect(fixture.nativeElement.textContent).not.toContain('Mañana');
  });
  it('shows a recoverable schedule failure without clearing the content metrics', () => {
    const {fixture}=setup(undefined,throwError(() => new Error('offline')));
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los horarios');
    expect(fixture.componentInstance.metrics().published).toBe(7);
    expect(fixture.componentInstance.metrics().drafts).toBe(1);
  });
});
