import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AiConnectionsService, AiProviderStatus } from '../../../core/services/ai-connections.service';
import { AiConnectionsComponent } from './ai-connections.component';
import { TenantService } from '../../../core/services/tenant.service';

describe('AiConnectionsComponent', () => {
  const textProvider: AiProviderStatus = {
    provider: 'deepseek-text', label: 'DeepSeek · generación de texto',
    workspaceKeyConfigured: false, serverFallbackConfigured: true,
    effectiveSource: 'SERVER', updatedAt: null,
  };
  let component: AiConnectionsComponent;
  let api: { getStatuses: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
  let tenantApi: { getTenantInfo: ReturnType<typeof vi.fn>; updateProfile: ReturnType<typeof vi.fn>; testPrompt: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getStatuses: vi.fn(() => of([textProvider])),
      save: vi.fn(() => of({ ...textProvider, workspaceKeyConfigured: true, effectiveSource: 'WORKSPACE' as const })),
      remove: vi.fn(() => of(textProvider)),
    };
    tenantApi = {
      getTenantInfo: vi.fn(() => of({ appTextModel: 'deepseek-flash' })),
      updateProfile: vi.fn(() => of({ appTextModel: 'deepseek-v4-pro' })),
      testPrompt: vi.fn(() => of({ success: true, generatedSample: 'Conexión verificada.' })),
    };
    TestBed.configureTestingModule({
      imports: [AiConnectionsComponent],
      providers: [
        { provide: AiConnectionsService, useValue: api },
        { provide: TenantService, useValue: tenantApi },
      ],
    });
    component = TestBed.createComponent(AiConnectionsComponent).componentInstance;
    component.ngOnInit();
  });

  it('saves a workspace key, clears the input, and keeps the returned status secret-free', () => {
    component.updateKey('deepseek-text', 'deepseek-private-key');
    component.save('deepseek-text');

    expect(api.save).toHaveBeenCalledWith('deepseek-text', 'deepseek-private-key');
    expect(component.keys()['deepseek-text']).toBe('');
    expect(component.providers()[0].workspaceKeyConfigured).toBe(true);
    expect(JSON.stringify(component.providers())).not.toContain('deepseek-private-key');
  });

  it('retains the entered key and shows a recoverable error when save fails', () => {
    api.save.mockReturnValue(throwError(() => ({ error: { message: 'Servicio no disponible' } })));
    component.updateKey('deepseek-text', 'deepseek-private-key');
    component.save('deepseek-text');

    expect(component.keys()['deepseek-text']).toBe('deepseek-private-key');
    expect(component.error()).toBe('Servicio no disponible');
  });

  it('loads and saves the chosen DeepSeek model as a workspace setting', () => {
    expect(component.selectedTextModel()).toBe('deepseek-flash');
    component.chooseTextModel('deepseek-v4-pro');
    component.saveTextModel();

    expect(tenantApi.updateProfile).toHaveBeenCalledWith({ appTextModel: 'deepseek-v4-pro' });
    expect(component.selectedTextModel()).toBe('deepseek-v4-pro');
    expect(component.textModelMessage()).toContain('guardado');
  });

  it('keeps the selected text model visible when the workspace save fails', () => {
    tenantApi.updateProfile.mockReturnValue(throwError(() => ({ error: { message: 'Sin conexión' } })));
    component.chooseTextModel('deepseek-v4-pro');
    component.saveTextModel();

    expect(component.selectedTextModel()).toBe('deepseek-v4-pro');
    expect(component.textModelError()).toBe('Sin conexión');
  });

  it('tests the active text provider through the real prompt endpoint without saving the sample', () => {
    component.testTextProvider();

    expect(tenantApi.testPrompt).toHaveBeenCalledWith(
      expect.stringContaining('No inventes datos'),
      'Prueba de conexión de AutoPost',
    );
    expect(component.textProviderTestResult()).toBe('Conexión verificada.');
    expect(component.textProviderTestError()).toBe('');
  });

  it('keeps provider-test errors recoverable and does not overwrite the selected model', () => {
    tenantApi.testPrompt.mockReturnValue(throwError(() => ({ error: { message: 'Cuota agotada' } })));
    component.chooseTextModel('deepseek-v4-pro');
    component.testTextProvider();

    expect(component.textProviderTestError()).toBe('Cuota agotada');
    expect(component.selectedTextModel()).toBe('deepseek-v4-pro');
  });

  it('does not send a test request when no text provider is configured', () => {
    api.getStatuses.mockReturnValue(of([{ ...textProvider, serverFallbackConfigured: false, effectiveSource: 'NONE' as const }]));
    component.load();
    component.testTextProvider();

    expect(component.canTestTextProvider()).toBe(false);
    expect(tenantApi.testPrompt).not.toHaveBeenCalled();
  });

  it('describes stored credentials as configured rather than claiming the provider is connected', () => {
    expect(component.statusLabel(textProvider)).toContain('credencial configurada en el servidor');
    expect(component.statusLabel({
      ...textProvider,
      effectiveSource: 'WORKSPACE',
      workspaceKeyConfigured: true,
    })).toContain('clave guardada para este espacio');
    expect(component.statusLabel({
      ...textProvider,
      effectiveSource: 'NONE',
      serverFallbackConfigured: false,
    })).toContain('No hay una clave propia');
  });
});
