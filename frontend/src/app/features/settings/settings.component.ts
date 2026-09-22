import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { ScheduleService, Schedule } from '../../core/services/schedule.service';
import { DatePipe } from '@angular/common';

export interface PromptVersion {
  id: string;
  timestamp: string;
  prompt: string;
  author: string;
}

export interface AuditLog {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  user: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe],
  template: `
    <div class="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Ajustes de Publicación & IA</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Configura la voz de la IA, los horarios programados en Quartz y la zona horaria del motor Zero-Touch</p>
      </div>

      @if (successMessage()) {
        <div class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>{{ successMessage() }}</span>
          </div>
          <button (click)="successMessage.set(null)" class="text-emerald-600 dark:text-emerald-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      @if (errorMessage()) {
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            <span>{{ errorMessage() }}</span>
          </div>
          <button (click)="errorMessage.set(null)" class="text-rose-600 dark:text-rose-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      <!-- MODAL DE SIMULACIÓN / DRY-RUN DE PROMPT -->
      @if (showDryRunModal()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                  <h3 class="font-bold text-base text-slate-900 dark:text-white">Simulación de Post con Prompt Actual (Dry-Run)</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Genera una publicación de prueba sin publicarla en LinkedIn</p>
                </div>
              </div>
              <button (click)="closeDryRunModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            <div class="p-6 overflow-y-auto space-y-4 flex-1">
              @if (isSimulating()) {
                <div class="py-12 text-center space-y-3">
                  <div class="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Generando post simulado aplicando el System Prompt...</p>
                </div>
              } @else {
                <div class="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div class="flex items-center justify-between text-xs text-slate-500">
                    <span class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Vista Previa LinkedIn (Borrador Simulado)</span>
                    <span>~480 Tokens</span>
                  </div>
                  <div class="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                    {{ simulatedPost() }}
                  </div>
                </div>
              }
            </div>

            <div class="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <button (click)="closeDryRunModal()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                Cerrar Simulación
              </button>
              <button (click)="generateDryRun()" [disabled]="isSimulating()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span>Generar Otra Variante</span>
              </button>
            </div>
          </div>
        </div>
      }

      <div class="space-y-8">

        <!-- SECCIÓN 1: HORARIOS DE PUBLICACIÓN AUTOMÁTICA (QUARTZ) -->
        <div class="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Horarios de Publicación Automática (Quartz)</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Define las horas exactas en las que el motor Zero-Touch disparará automáticamente tus publicaciones en LinkedIn.
              </p>
            </div>

            <!-- ZONA HORARIA DEL TENANT -->
            <div class="w-full sm:w-64">
              <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Zona Horaria del Tenant</label>
              <select [formControl]="timezoneControl" (change)="onTimezoneChange()"
                      class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500">
                <option value="America/Lima">America/Lima (UTC-5)</option>
                <option value="America/Bogota">America/Bogota (UTC-5)</option>
                <option value="America/Mexico_City">America/Mexico_City (UTC-6)</option>
                <option value="America/Santiago">America/Santiago (UTC-3)</option>
                <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
                <option value="Europe/Madrid">Europe/Madrid (UTC+1)</option>
              </select>
            </div>
          </div>

          <!-- FORMULARIO DE AGREGAR / EDITAR HORARIO -->
          <form [formGroup]="scheduleForm" (ngSubmit)="addOrUpdateSchedule()" class="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">
                {{ editingScheduleId() ? 'Editando Horario Programado' : 'Agregar Nueva Hora de Publicación' }}
              </span>
              @if (editingScheduleId()) {
                <button type="button" (click)="cancelScheduleEdit()" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">Cancelar Edición</button>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Hora Exacta</label>
                <input formControlName="time" type="time"
                       class="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">Frecuencia de Días</label>
                <select formControlName="frequency" class="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500">
                  <option value="DAILY">Todos los Días (Lunes a Domingo)</option>
                  <option value="WEEKDAYS">Días Laborables (Lunes a Viernes)</option>
                  <option value="MON_WED_FRI">Lunes, Miércoles y Viernes</option>
                </select>
              </div>
            </div>

            <button type="submit" [disabled]="scheduleForm.invalid || addingSchedule()"
                    class="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer">
              {{ addingSchedule() ? 'Guardando en Quartz...' : (editingScheduleId() ? 'Actualizar Horario' : 'Guardar Horario en Quartz') }}
            </button>
          </form>

          <!-- LISTA DE HORARIOS PROGRAMADOS ACTIVOS -->
          <div class="space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Horarios Configurados en Quartz</h3>

            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (s of schedules(); track s.id) {
                <div class="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <div>
                      <div class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{{ s.description }}</div>
                      <div class="text-[11px] font-mono text-slate-500 dark:text-slate-400">Expresión Cron: <code>{{ s.cronExpression }}</code></div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button (click)="startEditSchedule(s)" class="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer">
                      Editar
                    </button>
                    <button (click)="deleteSchedule(s.id)" class="px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">
                      Eliminar
                    </button>
                  </div>
                </div>
              } @empty {
                <p class="text-xs text-slate-500 py-6 text-center">No hay horarios programados. Agrega uno arriba para automatizar tus publicaciones.</p>
              }
            </div>
          </div>
        </div>


        <!-- SECCIÓN 3: REGISTRO DE AUDITORÍA Y SEGURIDAD -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span>Registro de Auditoría de Configuración</span>
            </h2>
            <span class="text-xs text-slate-500 font-mono">Últimos cambios</span>
          </div>

          <div class="divide-y divide-slate-100 dark:divide-slate-800/60">
            @for (log of auditLogs(); track log.id) {
              <div class="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2.5">
                  <span class="font-bold text-slate-800 dark:text-slate-200">{{ log.action }}</span>
                  <span class="text-slate-500 dark:text-slate-400">{{ log.detail }}</span>
                </div>
                <div class="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>{{ log.user }}</span>
                  <span>{{ log.timestamp | date:'dd/MM HH:mm' }}</span>
                </div>
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private tenantService = inject(TenantService);
  private scheduleService = inject(ScheduleService);
  authService = inject(AuthService);

  savingPrompt = signal(false);
  addingSchedule = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  schedules = signal<Schedule[]>([]);

  // Dry Run Simulation Modal Signals
  showDryRunModal = signal(false);
  isSimulating = signal(false);
  simulatedPost = signal<string>('');

  editingScheduleId = signal<string | null>(null);

  timezoneControl = this.fb.control('America/Lima');

  promptForm = this.fb.group({
    systemPrompt: ['Eres Deyvid Jair Chupillon Silva, Desarrollador Junior Frontend/Fullstack apasionado por Spring Boot, Angular y la arquitectura de software moderna. Genera posts con tono profesional, conciso, ejemplos técnicos claros y llamadas a la acción.', Validators.required]
  });

  scheduleForm = this.fb.group({
    time: ['09:00', Validators.required],
    frequency: ['DAILY', Validators.required]
  });

  promptVersions = signal<PromptVersion[]>([
    {
      id: '2',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      prompt: 'Eres Deyvid Jair Chupillon Silva, Desarrollador Junior Frontend/Fullstack...',
      author: 'Deyvid'
    },
    {
      id: '1',
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      prompt: 'Eres un asistente especializado en redacción técnica para LinkedIn con enfoque en Spring Boot y Angular.',
      author: 'Sistema (Default)'
    }
  ]);

  auditLogs = signal<AuditLog[]>([]);

  ngOnInit(): void {
    const savedLogs = localStorage.getItem('tenant_audit_logs');
    if (savedLogs) {
      try {
        this.auditLogs.set(JSON.parse(savedLogs));
      } catch (e) {
        console.warn('Error leyendo audit logs de localStorage:', e);
      }
    }

    this.tenantService.getTenantInfo().subscribe({
      next: (tenant) => {
        if (tenant?.systemPrompt) {
          this.promptForm.patchValue({ systemPrompt: tenant.systemPrompt });
        }
        if (tenant?.timezone) {
          this.timezoneControl.setValue(tenant.timezone);
        }
      },
      error: (err) => console.warn('No se pudo cargar la configuración de tenant:', err)
    });

    this.loadSchedules();
  }

  promptLength(): number {
    return (this.promptForm.value.systemPrompt || '').length;
  }

  promptWords(): number {
    const text = (this.promptForm.value.systemPrompt || '').trim();
    return text ? text.split(/\s+/).length : 0;
  }

  loadSchedules(): void {
    this.scheduleService.getSchedules().subscribe({
      next: (list) => this.schedules.set(list || []),
      error: (err) => console.warn('Error cargando horarios de publicación:', err)
    });
  }

  onTimezoneChange(): void {
    this.saveSystemPrompt();
  }

  saveSystemPrompt(): void {
    if (this.promptForm.invalid) return;
    this.savingPrompt.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const systemPrompt = this.promptForm.value.systemPrompt || '';
    const timezone = this.timezoneControl.value || 'America/Lima';

    this.tenantService.updateTenant(systemPrompt, timezone).subscribe({
      next: () => {
        this.savingPrompt.set(false);
        this.successMessage.set('Ajustes de System Prompt y Zona Horaria guardados correctamente.');
        this.addAuditLog('System Prompt Guardado', `Zona horaria: ${timezone}`);
      },
      error: (err) => {
        this.savingPrompt.set(false);
        this.errorMessage.set(err?.error?.message || 'Error guardando ajustes de IA y zona horaria');
      }
    });
  }

  openDryRunModal(): void {
    this.showDryRunModal.set(true);
    this.generateDryRun();
  }

  closeDryRunModal(): void {
    this.showDryRunModal.set(false);
  }

  generateDryRun(): void {
    this.isSimulating.set(true);
    setTimeout(() => {
      this.isSimulating.set(false);
      this.simulatedPost.set(`¿Cómo optimizar llamadas REST en Angular 22 con Signals y Spring Boot?

Muchos desarrolladores siguen usando patrones reactivos pesados para peticiones simples. En mi último proyecto implementé la nueva API nativa de recursos con inject():

Beneficios clave:
1. Menos boilerplate en componentes standalone
2. Actualizaciones atómicas en el Change Detection
3. Seguridad de tipos end-to-end con DTOs de Spring Boot

¿Ya migraste tus servicios a Signals o sigues utilizando BehaviorSubjects tradicionales? ¡Te leo en los comentarios!

#Angular #SpringBoot #Java #WebDev #CleanCode`);
    }, 1200);
  }

  restorePromptVersion(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const versionId = select.value;
    if (!versionId) return;

    const found = this.promptVersions().find(v => v.id === versionId);
    if (found) {
      this.promptForm.patchValue({ systemPrompt: found.prompt });
      this.successMessage.set(`Versión ${versionId} restaurada en el editor.`);
    }
  }

  startEditSchedule(s: Schedule): void {
    this.editingScheduleId.set(s.id);
    let time = '09:00';
    const parts = s.cronExpression.split(' ');
    if (parts.length >= 3) {
      const min = parts[1].padStart(2, '0');
      const hour = parts[2].padStart(2, '0');
      time = `${hour}:${min}`;
    }
    this.scheduleForm.patchValue({ time, frequency: 'DAILY' });
  }

  cancelScheduleEdit(): void {
    this.editingScheduleId.set(null);
    this.scheduleForm.reset({ time: '09:00', frequency: 'DAILY' });
  }

  addOrUpdateSchedule(): void {
    if (this.scheduleForm.invalid) return;
    this.addingSchedule.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const { time, frequency } = this.scheduleForm.value;
    const [hoursStr, minutesStr] = time!.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    let cron = `0 ${minutes} ${hours} * * ?`;
    let desc = `Diario a las ${time}`;

    if (frequency === 'WEEKDAYS') {
      cron = `0 ${minutes} ${hours} ? * MON-FRI`;
      desc = `Lun-Vie a las ${time}`;
    } else if (frequency === 'MON_WED_FRI') {
      cron = `0 ${minutes} ${hours} ? * MON,WED,FRI`;
      desc = `Lun, Mié, Vie a las ${time}`;
    }

    if (this.editingScheduleId()) {
      this.scheduleService.deleteSchedule(this.editingScheduleId()!).subscribe({
        next: () => {
          this.scheduleService.createSchedule(cron, desc).subscribe({
            next: () => {
              this.addingSchedule.set(false);
              this.editingScheduleId.set(null);
              this.successMessage.set('Horario actualizado exitosamente en Quartz.');
              this.scheduleForm.reset({ time: '09:00', frequency: 'DAILY' });
              this.loadSchedules();
              this.addAuditLog('Horario Actualizado', desc);
            },
            error: () => this.addingSchedule.set(false)
          });
        },
        error: () => this.addingSchedule.set(false)
      });
      return;
    }

    this.scheduleService.createSchedule(cron, desc).subscribe({
      next: () => {
        this.addingSchedule.set(false);
        this.successMessage.set('Horario de publicación registrado exitosamente en Quartz.');
        this.loadSchedules();
        this.addAuditLog('Horario Creado', desc);
      },
      error: (err) => {
        this.addingSchedule.set(false);
        this.errorMessage.set(err?.error?.message || 'Error agregando el horario programado');
      }
    });
  }

  deleteSchedule(id: string): void {
    if (!confirm('¿Deseas eliminar este horario programado de Quartz?')) return;
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.scheduleService.deleteSchedule(id).subscribe({
      next: () => {
        this.successMessage.set('Horario programado eliminado correctamente.');
        this.loadSchedules();
        this.addAuditLog('Horario Eliminado', `ID: ${id}`);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al eliminar el horario');
      }
    });
  }

  triggerSchedule(id: string): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.scheduleService.triggerSchedule(id).subscribe({
      next: (res) => {
        this.successMessage.set('🚀 ¡Horario ejecutado con éxito! El pipeline se disparó inmediatamente.');
        this.addAuditLog('Disparo Manual de Horario', `ID: ${id}`);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al disparar el horario en Quartz.');
      }
    });
  }

  private addAuditLog(action: string, detail: string): void {
    const newLog: AuditLog = {
      id: String(Date.now()),
      action,
      detail,
      timestamp: new Date().toISOString(),
      user: this.authService.currentUserSignal()?.name || 'Deyvid'
    };
    this.auditLogs.update(logs => {
      const updated = [newLog, ...logs.slice(0, 4)];
      try {
        localStorage.setItem('tenant_audit_logs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }
}
