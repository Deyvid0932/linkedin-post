import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { ScheduleService } from '../../core/services/schedule.service';
import { TenantService } from '../../core/services/tenant.service';
import { AiConnectionsService } from '../../core/services/ai-connections.service';

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
          provide: AiConnectionsService,
          useValue: {
            getImageModels: () => of([
              { id: 'gpt-image-2', name: 'GPT Image 2', estimatedPriceUsd: 0.066 },
              { id: 'ideogram/v4/instant', name: 'Ideogram V4 Instant', estimatedPriceUsd: 0.004 },
              { id: 'qwen-image-2.1/text-to-image', name: 'Qwen Image 2.1', estimatedPriceUsd: 0.02 },
              { id: 'qwen-image-3', name: 'Qwen Image 3', estimatedPriceUsd: 0.03 },
              { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite', estimatedPriceUsd: 0.04 },
              { id: 'google/gemini-nano-banana-2.1', name: 'Nano Banana 2.1', estimatedPriceUsd: 0.061 },
            ]),
          },
        },
        {
          provide: TenantService,
          useValue: {
            getProfile: () => of({ isActive:true, isEmergencyPaused:true, timezone:'America/Lima' }),
            emergencyPause: vi.fn(() => of({isEmergencyPaused:true})),
            emergencyResume: vi.fn(() => of({isEmergencyPaused:false})),
            getTenantInfo: () => of({ systemPrompt: 'Contexto', timezone: 'America/Lima' }),
            updateProfile: () => of({}),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  it('keeps publication paused until the user explicitly enables it from Settings', () => {
    const tenant = TestBed.inject(TenantService);
    expect(component.automation.enabled()).toBe(false);
    expect(tenant.emergencyResume).not.toHaveBeenCalled();
    component.automation.toggle();
    expect(tenant.emergencyResume).toHaveBeenCalledOnce();
    expect(component.automation.enabled()).toBe(true);
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

  it('explains when the administrator overrides a workspace automatic mode', () => {
    const tenant = TestBed.inject(TenantService);
    vi.spyOn(tenant, 'getTenantInfo').mockReturnValue(of({
      id: 'tenant-1', systemPrompt: 'Contexto', timezone: 'America/Lima', isActive: true,
      createdAt: '2026-10-17T12:00:00', appApprovalMode: 'AUTOMATIC', platformApprovalRequired: true,
    }));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La administración exige revisión');
    expect(fixture.componentInstance.appForm.controls.appApprovalMode.value).toBe('AUTOMATIC');
  });

  it('loads NanoGPT models from the backend and sorts by estimated price', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    const models = fixture.componentInstance.imageModels();
    const prices = models.map((model) => model.estimatedPriceUsd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(models.map((model) => model.id)).toContain(
      'google/gemini-nano-banana-2.1',
    );
    expect(models.map((model) => model.id)).toContain(
      'qwen-image-2.1/text-to-image',
    );
    expect(models.map((model) => model.id)).toContain('qwen-image-3');
    expect(models.map((model) => model.id)).toContain('nano-banana-2-lite');
    expect(models.map((model) => model.id)).toContain('ideogram/v4/instant');
  });

  it('blocks image model saving and offers retry when the catalog cannot load', () => {
    const connections = TestBed.inject(AiConnectionsService);
    vi.spyOn(connections, 'getImageModels').mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    fixture.componentInstance.saveAppConfig();

    expect(fixture.componentInstance.imageModelsError()).toContain('No pudimos cargar');
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    expect(fixture.componentInstance.savingAppConfig()).toBe(false);
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
