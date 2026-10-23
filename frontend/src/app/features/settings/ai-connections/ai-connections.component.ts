import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AiConnectionsService, AiProviderId, AiProviderStatus } from '../../../core/services/ai-connections.service';
import { TenantService } from '../../../core/services/tenant.service';

type DeepSeekTextModel = 'deepseek-flash' | 'deepseek-v4-pro';

@Component({
  selector: 'app-ai-connections',
  standalone: true,
  templateUrl: './ai-connections.component.html',
  styleUrl: './ai-connections.component.css',
})
export class AiConnectionsComponent implements OnInit {
  private readonly connections = inject(AiConnectionsService);
  private readonly tenantService = inject(TenantService);
  readonly providers = signal<AiProviderStatus[]>([]);
  readonly keys = signal<Record<string, string>>({});
  readonly revealed = signal<Record<string, boolean>>({});
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly busyProvider = signal<AiProviderId | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly textModels = [
    { id: 'deepseek-flash', name: 'DeepSeek Flash', detail: 'Más económico; recomendado para redactar publicaciones' },
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', detail: 'Mayor capacidad; coste superior' },
  ] as const;
  readonly selectedTextModel = signal<DeepSeekTextModel>('deepseek-flash');
  readonly loadingTextModel = signal(true);
  readonly textModelLoadFailed = signal(false);
  readonly savingTextModel = signal(false);
  readonly textModelError = signal('');
  readonly textModelMessage = signal('');
  readonly testingTextProvider = signal(false);
  readonly textProviderTestResult = signal('');
  readonly textProviderTestError = signal('');

  ngOnInit(): void {
    this.load();
    this.loadTextModel();
  }

  loadTextModel(): void {
    this.loadingTextModel.set(true);
    this.textModelLoadFailed.set(false);
    this.textModelError.set('');
    this.tenantService.getTenantInfo().pipe(finalize(() => this.loadingTextModel.set(false))).subscribe({
      next: tenant => this.selectedTextModel.set(tenant.appTextModel === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash'),
      error: () => {
        this.textModelLoadFailed.set(true);
        this.textModelError.set('No se pudo consultar el modelo activo. Vuelve a intentarlo antes de cambiarlo.');
      },
    });
  }

  chooseTextModel(value: string): void {
    if (value !== 'deepseek-flash' && value !== 'deepseek-v4-pro') return;
    this.selectedTextModel.set(value);
    this.textModelError.set('');
    this.textModelMessage.set('');
    this.textProviderTestResult.set('');
    this.textProviderTestError.set('');
  }

  testTextProvider(): void {
    const provider = this.providers().find(item => item.provider === 'deepseek-text');
    if (this.testingTextProvider() || !provider || provider.effectiveSource === 'NONE') return;

    this.testingTextProvider.set(true);
    this.textProviderTestResult.set('');
    this.textProviderTestError.set('');
    this.tenantService.testPrompt(
      'Responde con una sola frase breve en español explicando qué prueba esta conexión. No inventes datos ni atribuyas acciones al usuario.',
      'Prueba de conexión de AutoPost',
    ).pipe(finalize(() => this.testingTextProvider.set(false))).subscribe({
      next: response => {
        if (!response.success || !response.generatedSample?.trim()) {
          this.textProviderTestError.set('El proveedor respondió sin texto. Revisa el modelo y vuelve a probar.');
          return;
        }
        this.textProviderTestResult.set(response.generatedSample.trim());
      },
      error: (err: { error?: { message?: string } }) => this.textProviderTestError.set(
        err.error?.message || 'No se pudo probar el proveedor. Revisa la clave, el modelo y la cuota disponible.'),
    });
  }

  canTestTextProvider(): boolean {
    return this.providers().some(provider =>
      provider.provider === 'deepseek-text' && provider.effectiveSource !== 'NONE');
  }

  saveTextModel(): void {
    if (this.loadingTextModel() || this.textModelLoadFailed() || this.savingTextModel()) return;
    this.savingTextModel.set(true);
    this.textModelError.set('');
    this.textModelMessage.set('');
    this.tenantService.updateProfile({ appTextModel: this.selectedTextModel() })
      .pipe(finalize(() => this.savingTextModel.set(false)))
      .subscribe({
        next: tenant => {
          this.selectedTextModel.set(tenant.appTextModel === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-flash');
          this.textModelMessage.set('Modelo de texto guardado para este espacio de trabajo.');
        },
        error: (err: { error?: { message?: string } }) => this.textModelError.set(
          err.error?.message || 'No se pudo guardar el modelo. Tu selección sigue disponible para reintentar.'),
      });
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set('');
    this.connections.getStatuses().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: statuses => this.providers.set(statuses),
      error: () => {
        this.loadFailed.set(true);
        this.error.set('No se pudo cargar el estado de los proveedores. Puedes reintentar.');
      },
    });
  }

  updateKey(provider: AiProviderId, value: string): void {
    this.keys.update(current => ({ ...current, [provider]: value }));
    this.error.set('');
    this.message.set('');
  }

  toggleReveal(provider: AiProviderId): void {
    this.revealed.update(current => ({ ...current, [provider]: !current[provider] }));
  }

  save(provider: AiProviderId): void {
    const key = (this.keys()[provider] ?? '').trim();
    if (key.length < 8 || key.length > 512) {
      this.error.set('La clave debe tener entre 8 y 512 caracteres.');
      return;
    }
    this.busyProvider.set(provider);
    this.error.set('');
    this.message.set('');
    this.connections.save(provider, key).pipe(finalize(() => this.busyProvider.set(null))).subscribe({
      next: status => {
        this.replaceStatus(status);
        this.keys.update(current => ({ ...current, [provider]: '' }));
        this.message.set(`Se guardó la clave para ${status.label}.`);
      },
      error: (err: { error?: { message?: string } }) => this.error.set(
        err.error?.message || 'No se pudo guardar la clave. Revisa la configuración e inténtalo de nuevo.'),
    });
  }

  remove(provider: AiProviderId): void {
    this.busyProvider.set(provider);
    this.error.set('');
    this.message.set('');
    this.connections.remove(provider).pipe(finalize(() => this.busyProvider.set(null))).subscribe({
      next: status => {
        this.replaceStatus(status);
        this.message.set(`Se eliminó la clave propia para ${status.label}.`);
      },
      error: (err: { error?: { message?: string } }) => this.error.set(
        err.error?.message || 'No se pudo eliminar la clave. Inténtalo de nuevo.'),
    });
  }

  statusLabel(status: AiProviderStatus): string {
    if (status.effectiveSource === 'WORKSPACE') return 'AutoPost usará la clave guardada para este espacio de trabajo';
    if (status.effectiveSource === 'SERVER') return 'AutoPost usará la credencial configurada en el servidor';
    return 'No hay una clave propia ni una credencial de servidor configurada';
  }

  private replaceStatus(updated: AiProviderStatus): void {
    this.providers.update(items => items.map(item => item.provider === updated.provider ? updated : item));
  }
}
