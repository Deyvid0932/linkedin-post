import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TenantService } from '../../../core/services/tenant.service';
import { parseVoice, serializeVoice } from '../../../core/services/voice-format';
@Component({
  selector: 'app-voice-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './voice-settings.component.html',
})
export class VoiceSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tenant = inject(TenantService);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly testing = signal(false);
  readonly sample = signal('');
  readonly sampleError = signal('');
  readonly sampleTopic = signal('Un aprendizaje sobre diseño de software');
  readonly form = this.fb.nonNullable.group({
    experience: [''],
    style: [''],
    topics: [''],
    avoid: [''],
    additional: [''],
  });
  readonly fields = [
    {
      key: 'experience',
      label: 'Experiencia',
      placeholder: 'Especialidad y experiencia que quieras aportar',
    },
    { key: 'style', label: 'Estilo', placeholder: 'Claro y cercano, técnico y directo…' },
    { key: 'topics', label: 'Temas', placeholder: 'Temas sobre los que sueles escribir' },
    {
      key: 'avoid',
      label: 'Expresiones a evitar',
      placeholder: 'Palabras, promesas o frases que no usarías',
    },
    {
      key: 'additional',
      label: 'Instrucciones adicionales',
      placeholder: 'Preferencias estables para la IA',
    },
  ];
  ngOnInit(): void {
    this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.tenant
      .getTenantInfo()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (t) => {
          this.form.setValue(parseVoice(t.systemPrompt || ''));
          this.loaded.set(true);
        },
        error: () => this.error.set('No pudimos cargar tu voz. Reintenta antes de guardar.'),
      });
  }
  save(): void {
    if (!this.loaded() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.tenant
      .updateProfile({ systemPrompt: serializeVoice(this.form.getRawValue()) })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.message.set('Voz guardada.');
        },
        error: (e) =>
          this.error.set(e?.error?.message || 'No pudimos guardar. Tus instrucciones siguen aquí.'),
      });
  }
  test(): void {
    if (this.testing() || !this.loaded() || !this.sampleTopic().trim()) return;
    this.testing.set(true);
    this.sampleError.set('');
    this.tenant
      .testPrompt(serializeVoice(this.form.getRawValue()), this.sampleTopic().trim())
      .pipe(finalize(() => this.testing.set(false)))
      .subscribe({
        next: (r) => {
          if (r.success && r.generatedSample) this.sample.set(r.generatedSample);
          else this.sampleError.set('La IA no devolvió un ejemplo.');
        },
        error: () =>
          this.sampleError.set('No pudimos generar el ejemplo. Tus ajustes se conservan.'),
      });
  }
}
