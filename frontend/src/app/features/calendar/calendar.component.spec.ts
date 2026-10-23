import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CalendarComponent } from './calendar.component';
import { PublicationService } from '../../core/services/publication.service';
import { ScheduleService } from '../../core/services/schedule.service';
import { TenantService } from '../../core/services/tenant.service';

describe('CalendarComponent', () => {
  let fixture: ComponentFixture<CalendarComponent>;
  let schedules: { getSchedules: ReturnType<typeof vi.fn> };
  let publications: { getQueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    schedules = { getSchedules: vi.fn(() => of([])) };
    publications = { getQueue: vi.fn(() => of([])) };
    TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        provideRouter([]),
        { provide: ScheduleService, useValue: schedules },
        { provide: PublicationService, useValue: publications },
        { provide: TenantService, useValue: { getTenantInfo: () => of({ timezone: 'America/Lima' }) } },
      ],
    });
    fixture = TestBed.createComponent(CalendarComponent);
    fixture.detectChanges();
  });

  it('shows recurring daily slots across the week and keeps queued posts separate', () => {
    schedules.getSchedules.mockReturnValue(
      of([{ id: 'daily', cronExpression: '0 0 9 * * ?', description: 'Diario a las 09:00', isActive: true }]),
    );
    publications.getQueue.mockReturnValue(of([{ id: 'draft-1', generatedText: 'Post aprobado', sourceReference: 'Tema', imageUrl: null }]));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.componentInstance.days()).toHaveLength(7);
    expect(fixture.componentInstance.days().every((day) => day.slots[0]?.time === '09:00')).toBe(true);
    expect(fixture.componentInstance.queuedPosts()[0].generatedText).toBe('Post aprobado');
    expect(fixture.nativeElement.textContent).toContain('no tienen una fecha individual');
  });

  it('does not place custom cron schedules on guessed calendar dates', () => {
    schedules.getSchedules.mockReturnValue(
      of([{ id: 'custom', cronExpression: '0 0 9 1 * ?', description: 'Día primero', isActive: true }]),
    );
    fixture.componentInstance.load();

    expect(fixture.componentInstance.recurringSchedules()).toHaveLength(0);
    expect(fixture.componentInstance.customSchedules().map((entry) => entry.id)).toEqual(['custom']);
  });

  it('uses the tenant timezone and builds a complete month grid', () => {
    fixture.componentInstance.setView('month');
    fixture.detectChanges();

    expect(fixture.componentInstance.timezone()).toBe('America/Lima');
    expect(fixture.componentInstance.days().length % 7).toBe(0);
    expect(fixture.componentInstance.days().length).toBeGreaterThanOrEqual(28);
  });

  it('announces the calendar view as a pressed button group', () => {
    const monthButton = fixture.nativeElement.querySelector('button[aria-pressed="true"]') as HTMLButtonElement;

    expect(fixture.nativeElement.querySelector('[role="group"][aria-label="Vista del calendario"]')).not.toBeNull();
    expect(monthButton.textContent).toContain('Semana');
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();

    const monthViewButton = Array.from(
      fixture.nativeElement.querySelectorAll('.calendar-view-switch button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Mes');
    expect(monthViewButton).toBeDefined();
    monthViewButton?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Mes');
  });

  it('shows a recoverable error when schedules cannot be loaded', () => {
    schedules.getSchedules.mockReturnValue(throwError(() => new Error('offline')));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(fixture.componentInstance.scheduleError()).toContain('No pudimos cargar');
    expect(fixture.componentInstance.loadingSchedules()).toBe(false);
  });
});
