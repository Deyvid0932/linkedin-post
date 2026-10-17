import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { ScheduleService } from '../../core/services/schedule.service';
import { TenantService } from '../../core/services/tenant.service';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubAutomationService } from '../../core/services/github-automation.service';

describe('SettingsComponent schedule editing', () => {
  let component: SettingsComponent;
  let schedules: {
    getSchedules: ReturnType<typeof vi.fn>;
    createSchedule: ReturnType<typeof vi.fn>;
    updateSchedule: ReturnType<typeof vi.fn>;
    deleteSchedule: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    schedules = {
      getSchedules: vi.fn(() => of([])),
      createSchedule: vi.fn(() => of({})),
      updateSchedule: vi.fn(() => of({})),
      deleteSchedule: vi.fn(() => of(void 0)),
    };
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: ScheduleService, useValue: schedules },
        {
          provide: TenantService,
          useValue: {
            getTenantInfo: () => of({ systemPrompt: 'Contexto', timezone: 'America/Lima' }),
            updateProfile: () => of({}),
          },
        },
        { provide: CredentialService, useValue: { getMonitoredRepos: () => of([]) } },
        {
          provide: GitHubAutomationService,
          useValue: {
            get: () => of({}),
            save: () => of({}),
            pending: () => of([]),
            approve: () => of({ message: 'approved' }),
          },
        },
      ],
    });
    component = TestBed.createComponent(SettingsComponent).componentInstance;
  });

  it('updates an existing schedule in place instead of deleting it first', () => {
    component.editingScheduleId.set('schedule-1');
    component.scheduleForm.setValue({ time: '10:30', frequency: 'WEEKDAYS' });
    component.addOrUpdateSchedule();

    expect(schedules.updateSchedule).toHaveBeenCalledWith(
      'schedule-1',
      '0 30 10 ? * MON-FRI',
      'Lun–Vie a las 10:30',
    );
    expect(schedules.deleteSchedule).not.toHaveBeenCalled();
    expect(schedules.createSchedule).not.toHaveBeenCalled();
  });

  it('updates only the timezone field so the saved voice cannot be overwritten', () => {
    const tenant = TestBed.inject(TenantService);
    const update = vi.spyOn(tenant, 'updateProfile');
    component.changeTimezone('Europe/Madrid');
    expect(update).toHaveBeenCalledWith({ timezone: 'Europe/Madrid' });
  });

  it('persists the AutoPost approval mode and generation controls independently', () => {
    const tenant = TestBed.inject(TenantService);
    const update = vi.spyOn(tenant, 'updateProfile');
    component.appForm.setValue({
      appApprovalMode: 'AUTOMATIC',
      appTargetCharacters: 950,
      appImageModel: 'qwen-image-2.1/text-to-image',
    });
    component.saveAppConfig();
    expect(update).toHaveBeenCalledWith({
      appApprovalMode: 'AUTOMATIC',
      appTargetCharacters: 950,
      appImageModel: 'qwen-image-2.1/text-to-image',
    });
  });

  it('lists NanoGPT image models from the lowest to the highest estimated price', () => {
    const prices = component.imageModels.map((model) => Number(model.price.replace('~$', '')));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(component.imageModels.map((model) => model.id)).toContain(
      'google/gemini-nano-banana-2.1',
    );
    expect(component.imageModels.map((model) => model.id)).toContain(
      'qwen-image-2.1/text-to-image',
    );
  });

  it('keeps the edited schedule and form values when saving fails', () => {
    schedules.updateSchedule.mockReturnValue(
      throwError(() => ({ error: { message: 'No se pudo guardar' } })),
    );
    component.editingScheduleId.set('schedule-1');
    component.scheduleForm.setValue({ time: '10:30', frequency: 'DAILY' });
    component.addOrUpdateSchedule();

    expect(component.editingScheduleId()).toBe('schedule-1');
    expect(component.scheduleForm.controls.time.value).toBe('10:30');
    expect(component.errorMessage()).toBe('No se pudo guardar');
  });
});
