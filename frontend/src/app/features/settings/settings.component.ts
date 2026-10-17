import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { TenantService } from '../../core/services/tenant.service';
import { parseRecurring } from '../../core/services/schedule-format';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { Schedule, ScheduleService } from '../../core/services/schedule.service';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubRepo } from '../../core/models/credential.model';
import {
  GitHubAutomationConfig,
  GitHubAutomationService,
} from '../../core/services/github-automation.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DialogComponent],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tenantService = inject(TenantService);
  private readonly scheduleService = inject(ScheduleService);
  private readonly credentials = inject(CredentialService);
  private readonly actionsConfigService = inject(GitHubAutomationService);
  readonly parsePattern = parseRecurring;
  readonly imageModels = [
    {
      id: 'recraft-ai/recraft-v4.1-flash/text-to-image',
      name: 'Recraft V4.1 Flash · diseños e ilustraciones',
      price: '~$0.008',
    },
    {
      id: 'qwen-image-2.1/text-to-image',
      name: 'Qwen Image 2.1 · buen texto y relación calidad/precio',
      price: '~$0.020',
    },
    { id: 'bytedance/seedream-v5.0-flash', name: 'Seedream 5.0 Flash · rápido', price: '~$0.027' },
    { id: 'seedream-v4', name: 'Seedream 4.0 · composición y detalle', price: '~$0.030' },
    { id: 'nano-banana', name: 'Nano Banana · generación y edición', price: '~$0.039' },
    { id: 'nano-banana-2-fast', name: 'Nano Banana 2 Fast · 2K rápido', price: '~$0.045' },
    {
      id: 'black-forest-labs/flux-3/text-to-image',
      name: 'FLUX.3 Image · fotografía e ilustración',
      price: '~$0.050',
    },
    { id: 'ideogram/v4.5', name: 'Ideogram V4.5 · texto dentro de imágenes', price: '~$0.060' },
    {
      id: 'google/gemini-nano-banana-2.1',
      name: 'Nano Banana 2.1 · calidad y consistencia',
      price: '~$0.060',
    },
    { id: 'gpt-image-2', name: 'GPT Image 2 · modelo avanzado de OpenAI', price: '~$0.066' },
    { id: 'qwen-image-2.1-pro', name: 'Qwen Image 2.1 Pro · alta resolución', price: '~$0.075' },
    { id: 'nano-banana-pro', name: 'Nano Banana Pro · calidad profesional', price: '~$0.140' },
    { id: 'gpt-image-1.5', name: 'GPT Image 1.5 · opción premium', price: '~$0.167' },
  ] as const;
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
  readonly timezone = signal('America/Lima');
  readonly actionRepos = signal<GitHubRepo[]>([]);
  readonly actionsRepositoryId = signal('');
  readonly savingAppConfig = signal(false);
  readonly savingActionsConfig = signal(false);
  readonly loadingActionsConfig = signal(false);
  readonly actionsReview = signal<Record<string, unknown>[]>([]);
  readonly actionsReviewLoading = signal(false);
  readonly reviewingId = signal<string | null>(null);
  readonly savingTimezone = signal(false);
  readonly loadingSchedules = signal(true);
  readonly addingSchedule = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly schedules = signal<Schedule[]>([]);
  readonly editingScheduleId = signal<string | null>(null);
  readonly pendingDelete = signal<string | null>(null);
  readonly deleting = signal(false);
  private actionsLoadSequence = 0;
  readonly scheduleForm = this.fb.nonNullable.group({
    time: ['09:00', Validators.required],
    frequency: ['DAILY', Validators.required],
  });
  readonly appForm = this.fb.nonNullable.group({
    appApprovalMode: ['REQUIRE_APPROVAL'],
    appTargetCharacters: [1200, [Validators.min(100), Validators.max(3000)]],
    appImageModel: ['qwen-image-2.1/text-to-image'],
  });
  readonly actionsForm = this.fb.nonNullable.group({
    approvalMode: ['REQUIRE_APPROVAL'],
    targetCharacters: [1200, [Validators.min(100), Validators.max(3000)]],
    prompt: ['', Validators.maxLength(5000)],
    imageModel: ['qwen-image-2.1/text-to-image'],
    timezone: ['America/Lima'],
    publishTime: ['08:00', Validators.required],
    enabled: [false],
  });

  ngOnInit(): void {
    this.tenantService
      .getTenantInfo()
      .pipe(finalize(() => this.loadingTenant.set(false)))
      .subscribe({
        next: (tenant) => {
          this.timezone.set(tenant?.timezone || 'America/Lima');
          this.appForm.patchValue({
            appApprovalMode: tenant.appApprovalMode || 'REQUIRE_APPROVAL',
            appTargetCharacters: tenant.appTargetCharacters || 1200,
            appImageModel: this.normalizeAppImageModel(tenant.appImageModel),
          });
          this.actionsForm.controls.timezone.setValue(tenant?.timezone || 'America/Lima');
        },
        error: (err) =>
          this.errorMessage.set(
            this.errorFor(err, 'No pudimos cargar la zona horaria de la cuenta.'),
          ),
      });
    this.credentials
      .getMonitoredRepos()
      .pipe(catchError(() => of([])))
      .subscribe((repos) => {
        this.actionRepos.set(repos.filter((repo) => repo.isActive));
        const active = repos.filter((repo) => repo.isActive);
        if (!this.actionsRepositoryId() && active.length) {
          this.actionsRepositoryId.set(active[0].id);
          this.loadActionsConfig(active[0].id);
        }
      });
    this.loadSchedules();
  }

  saveAppConfig(): void {
    if (this.appForm.invalid || this.savingAppConfig()) return;
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
    return this.imageModels.some((option) => option.id === model)
      ? model!
      : 'qwen-image-2.1/text-to-image';
  }

  selectActionsRepository(repositoryId: string): void {
    this.actionsLoadSequence++;
    this.actionsRepositoryId.set(repositoryId);
    if (repositoryId) this.loadActionsConfig(repositoryId);
    else {
      this.loadingActionsConfig.set(false);
      this.actionsReview.set([]);
      this.actionsForm.reset({
        approvalMode: 'REQUIRE_APPROVAL',
        targetCharacters: 1200,
        prompt: '',
        imageModel: 'qwen-image-2.1/text-to-image',
        timezone: 'America/Lima',
        publishTime: '08:00',
        enabled: false,
      });
    }
  }

  private loadActionsConfig(repositoryId: string): void {
    const sequence = ++this.actionsLoadSequence;
    this.loadingActionsConfig.set(true);
    this.actionsConfigService
      .get(repositoryId)
      .pipe(
        finalize(() => {
          if (sequence === this.actionsLoadSequence) this.loadingActionsConfig.set(false);
        }),
      )
      .subscribe({
        next: (config) => {
          if (sequence === this.actionsLoadSequence && repositoryId === this.actionsRepositoryId())
            this.actionsForm.patchValue({
              ...config,
              imageModel: this.normalizeImageModel(config.imageModel),
            });
        },
        error: (err) => {
          if (sequence === this.actionsLoadSequence)
            this.errorMessage.set(
              this.errorFor(err, 'No pudimos leer la configuración de GitHub Actions.'),
            );
        },
      });
    this.loadActionsReview(repositoryId, sequence);
  }

  private loadActionsReview(repositoryId: string, sequence: number): void {
    this.actionsReviewLoading.set(true);
    this.actionsConfigService
      .pending(repositoryId)
      .pipe(finalize(() => this.actionsReviewLoading.set(false)))
      .subscribe({
        next: (posts) => {
          if (sequence === this.actionsLoadSequence && repositoryId === this.actionsRepositoryId())
            this.actionsReview.set(posts);
        },
        error: (err) => {
          if (sequence === this.actionsLoadSequence)
            this.errorMessage.set(this.errorFor(err, 'No pudimos leer los borradores de Actions.'));
        },
      });
  }

  approveActionsPost(postId: string): void {
    const repositoryId = this.actionsRepositoryId();
    if (!repositoryId || this.reviewingId()) return;
    this.reviewingId.set(postId);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.actionsConfigService
      .approve(repositoryId, postId)
      .pipe(finalize(() => this.reviewingId.set(null)))
      .subscribe({
        next: (result) => {
          this.successMessage.set(result.message);
          this.loadActionsReview(repositoryId, this.actionsLoadSequence);
        },
        error: (err) =>
          this.errorMessage.set(
            this.errorFor(
              err,
              'No se confirmó la aprobación. Revisa la cola de GitHub antes de repetirla.',
            ),
          ),
      });
  }

  saveActionsConfig(): void {
    const repositoryId = this.actionsRepositoryId();
    if (!repositoryId || this.actionsForm.invalid || this.savingActionsConfig()) return;
    this.savingActionsConfig.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    const raw = this.actionsForm.getRawValue();
    const config: GitHubAutomationConfig = {
      ...raw,
      approvalMode: raw.approvalMode as GitHubAutomationConfig['approvalMode'],
    };
    this.actionsConfigService
      .save(repositoryId, config)
      .pipe(finalize(() => this.savingActionsConfig.set(false)))
      .subscribe({
        next: () => this.successMessage.set('Configuración guardada en el repositorio de GitHub.'),
        error: (err) =>
          this.errorMessage.set(
            this.errorFor(err, 'No pudimos guardar la configuración en GitHub.'),
          ),
      });
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
