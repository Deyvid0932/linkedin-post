import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TenantService } from '../../../core/services/tenant.service';
import { VoiceSettingsComponent } from './voice-settings.component';

describe('VoiceSettingsComponent', () => {
  it('saves the prompt as a partial tenant update and tests that same editor prompt', () => {
    const api = {
      getTenantInfo: vi.fn(() => of({ systemPrompt: null, timezone: 'America/Lima' })),
      updateProfile: vi.fn(() => of({})),
      testPrompt: vi.fn(() =>
        of({ success: true, generatedSample: 'Ejemplo', topic: 'Tema', approach: 'PROFESSIONAL' }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [VoiceSettingsComponent],
      providers: [{ provide: TenantService, useValue: api }],
    });
    const fixture = TestBed.createComponent(VoiceSettingsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.form.controls.style.setValue('Técnico y cercano');
    component.save();
    expect(api.updateProfile).toHaveBeenCalledWith({
      systemPrompt: expect.stringContaining('Técnico y cercano'),
    });
    component.test();
    expect(api.testPrompt).toHaveBeenCalledWith(
      expect.stringContaining('Técnico y cercano'),
      'Un aprendizaje sobre diseño de software',
    );
    expect(component.sample()).toBe('Ejemplo');
  });
});
