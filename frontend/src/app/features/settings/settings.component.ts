import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { TenantService } from '../../core/services/tenant.service';
import { parseRecurring } from '../../core/services/schedule-format';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { Schedule, ScheduleService } from '../../core/services/schedule.service';
import { AiConnectionsService, NanoGptImageModel } from '../../core/services/ai-connections.service';
import { AutomationStateService } from '../../core/services/automation-state.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, DialogComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  readonly automation = inject(AutomationStateService);
  private readonly fb = inject(FormBuilder);
  private readonly tenantService = inject(TenantService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly aiConnectionsService = inject(AiConnectionsService);
  readonly parsePattern = parseRecurring;
  readonly imageModels = signal<NanoGptImageModel[]>([]);
  readonly loadingImageModels = signal(true);
  readonly imageModelsError = signal('');
  readonly week = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly custom = computed(() =>
    this.schedules().filter((s) => !parseRecurring(s.cronExpression)),
  );
  readonly agenda = computed(() =>
    this.week.map((_, day) =>
      this.schedules()
        .filter((s) => s.isActive)
        .flatMap((s) => {
          const p = parseRecurring(s.cronExpression);
          return p?.days.includes(day) ? [{ id: s.id, time: p.time }] : [];
        })
        .sort((a, b) => a.time.localeCompare(b.time)),
    ),
  );
  readonly loadingTenant = signal(true);
  readonly platformApprovalRequired = signal(false);
  readonly timezone = signal('America/Lima');
  readonly savingAppConfig = signal(false);
  readonly savingTimezone = signal(false);
  readonly loadingSchedules = signal(true);
  readonly addingSchedule = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly schedules = signal<Schedule[]>([]);
  readonly editingScheduleId = signal<string | null>(null);
  readonly pendingDelete = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly scheduleForm = this.fb.nonNullable.group({
    time: ['09:00', Validators.required],
    frequency: ['DAILY', Validators.required],
  });
  readonly appForm = this.fb.nonNullable.group({
    appApprovalMode: ['REQUIRE_APPROVAL'],
    appTargetCharacters: [1200, [Validators.min(100), Validators.max(3000)]],
    appImageModel: ['qwen-image-2.1/text-to-image'],
  });

  ngOnInit(): void {
    this.automation.load();
    this.tenantService
      .getTenantInfo()
      .pipe(finalize(() => this.loadingTenant.set(false)))
      .subscribe({
        next: (tenant) => {
          this.timezone.set(tenant?.timezone || 'America/Lima');
          this.platformApprovalRequired.set(tenant?.platformApprovalRequired ?? false);
          this.appForm.patchValue({
            appApprovalMode: tenant.appApprovalMode || 'REQUIRE_APPROVAL',
            appTargetCharacters: tenant.appTargetCharacters || 1200,
            appImageModel: tenant.appImageModel || 'qwen-image-2.1/text-to-image',
          });
        },
        error: (err) =>
          this.errorMessage.set(
            this.errorFor(err, 'No pudimos cargar la zona horaria de la cuenta.'),
          ),
      });
    this.loadImageModels();
    this.loadSchedules();
  }

  loadImageModels(): void {
    this.loadingImageModels.set(true);
    this.imageModelsError.set('');
    this.aiConnectionsService
      .getImageModels()
      .pipe(finalize(() => this.loadingImageModels.set(false)))
      .subscribe({
        next: (models) => {
          const catalog = (models || [])
            .filter((model) => model.id && model.name && Number.isFinite(model.estimatedPriceUsd) && model.estimatedPriceUsd >= 0)
            .sort((a, b) => a.estimatedPriceUsd - b.estimatedPriceUsd);
          if (!catalog.length) {
            this.imageModelsError.set('El catálogo de modelos de imagen está vacío.');
            return;
          }
          this.imageModels.set(catalog);
          const selected = this.appForm.controls.appImageModel.value;
          this.appForm.controls.appImageModel.setValue(this.normalizeImageModel(selected));
        },
        error: (err) => this.imageModelsError.set(
          this.errorFor(err, 'No pudimos cargar los modelos de imagen de NanoGPT.'),
        ),
      });
  }

  saveAppConfig(): void {
    if (this.appForm.invalid || this.savingAppConfig() || this.loadingImageModels() || this.imageModelsError() || !this.imageModels().length) return;
    this.savingAppConfig.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const value = this.appForm.getRawValue();
    this.tenantService
      .updateProfile({
        appApprovalMode: value.appApprovalMode as 'REQUIRE_APPROVAL' | 'AUTOMATIC',
        appTargetCharacters: value.appTargetCharacters,
        appImageModel: value.appImageModel,
      })
      .pipe(finalize(() => this.savingAppConfig.set(false)))
      .subscribe({
        next: () => this.successMessage.set('Configuración de AutoPost guardada.'),
        error: (err) =>
          this.errorMessage.set(
            this.errorFor(err, 'No pudimos guardar la configuración de AutoPost.'),
          ),
      });
  }

  private normalizeAppImageModel(model: string | null | undefined): string {
    return this.normalizeImageModel(model);
  }

  private normalizeImageModel(model: string | null | undefined): string {
    const legacy: Record<string, string> = {
      'flux-schnell': 'black-forest-labs/flux-3/text-to-image',
      'flux-dev': 'qwen-image-2.1/text-to-image',
      'nano-banana-2.1': 'google/gemini-nano-banana-2.1',
    };
    if (model && legacy[model]) return legacy[model];
    return this.imageModels().some((option) => option.id === model)
      ? model!
      : this.imageModels().some((option) => option.id === 'qwen-image-2.1/text-to-image')
        ? 'qwen-image-2.1/text-to-image'
        : this.imageModels()[0]?.id || 'qwen-image-2.1/text-to-image';
  }

  changeTimezone(value: string): void {
    const previous = this.timezone();
    this.timezone.set(value);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.savingTimezone.set(true);
    this.tenantService
      .updateProfile({ timezone: value })
      .pipe(finalize(() => this.savingTimezone.set(false)))
      .subscribe({
        next: (tenant) => {
          this.successMessage.set('Zona horaria actualizada.');
        },
        error: (err) => {
          this.timezone.set(previous);
          this.errorMessage.set(this.errorFor(err, 'No pudimos guardar la zona horaria.'));
        },
      });
  }

  loadSchedules(): void {
    this.loadingSchedules.set(true);
    this.scheduleService
      .getSchedules()
      .pipe(finalize(() => this.loadingSchedules.set(false)))
      .subscribe({
        next: (schedules) => this.schedules.set(schedules || []),
        error: (err) =>
          this.errorMessage.set(this.errorFor(err, 'No pudimos cargar los horarios.')),
      });
  }

  startEditSchedule(schedule: Schedule): void {
    const pattern = parseRecurring(schedule.cronExpression);
    if (!pattern) {
      this.errorMessage.set(
        'Este cron es personalizado. Se conserva sin convertirlo a una frecuencia distinta.',
      );
      return;
    }
    this.editingScheduleId.set(schedule.id);
    this.scheduleForm.setValue({ time: pattern.time, frequency: pattern.frequency });
  }

  cancelScheduleEdit(): void {
    this.editingScheduleId.set(null);
    this.scheduleForm.reset({ time: '09:00', frequency: 'DAILY' });
  }

  addOrUpdateSchedule(): void {
    if (this.scheduleForm.invalid || this.addingSchedule()) return;
    const { time, frequency } = this.scheduleForm.getRawValue();
    const [hour, minute] = time.split(':').map(Number);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      this.errorMessage.set('Introduce una hora válida.');
      return;
    }
    let cron = `0 ${minute} ${hour} * * ?`;
    let description = `Diario a las ${time}`;
    if (frequency === 'WEEKDAYS') {
      cron = `0 ${minute} ${hour} ? * MON-FRI`;
      description = `Lun–Vie a las ${time}`;
    }
    if (frequency === 'MON_WED_FRI') {
      cron = `0 ${minute} ${hour} ? * MON,WED,FRI`;
      description = `Lun, mié y vie a las ${time}`;
    }
    this.addingSchedule.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const persist = (isUpdate: boolean) =>
      (isUpdate
        ? this.scheduleService.updateSchedule(this.editingScheduleId()!, cron, description)
        : this.scheduleService.createSchedule(cron, description)
      )
        .pipe(finalize(() => this.addingSchedule.set(false)))
        .subscribe({
          next: () => {
            this.successMessage.set(isUpdate ? 'Horario actualizado.' : 'Horario añadido.');
            this.cancelScheduleEdit();
            this.loadSchedules();
          },
          error: (err) =>
            this.errorMessage.set(this.errorFor(err, 'No pudimos guardar el horario.')),
        });
    persist(!!this.editingScheduleId());
  }

  deleteSchedule(id: string): void {
    this.pendingDelete.set(id);
  }

  confirmDeleteSchedule(): void {
    const id = this.pendingDelete();
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.scheduleService
      .deleteSchedule(id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.pendingDelete.set(null);
          this.successMessage.set('Horario eliminado.');
          this.loadSchedules();
        },
        error: (err) =>
          this.errorMessage.set(this.errorFor(err, 'No pudimos eliminar el horario.')),
      });
  }

  private errorFor(
    err: { status?: number; message?: string; error?: { message?: string } },
    fallback: string,
  ): string {
    const message = err?.error?.message || '';
    if (
      err?.status === 0 ||
      /failed to fetch|http failure response/i.test(`${message} ${err?.message || ''}`)
    )
      return fallback;
    return message || fallback;
  }
}
