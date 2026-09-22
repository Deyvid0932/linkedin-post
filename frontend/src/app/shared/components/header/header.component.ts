import { Component, Output, EventEmitter, inject, signal, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ThemeToggleComponent, RouterLink],
  template: `
    <header class="h-20 border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">

      <!-- BOTÓN HAMBURGUESA MÓVIL Y CONTROLES DE PIPELINE -->
      <div class="flex items-center gap-2 sm:gap-3">
        <button (click)="toggleMobileMenu.emit()"
                class="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>

        <!-- PIPELINE TOGGLE -->
        <button (click)="togglePipeline()"
                class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 rounded-full border transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                [class]="isPipelineActive()
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-slate-400'">

          <div class="w-8 sm:w-10 h-4 sm:h-5 rounded-full transition-colors relative flex items-center p-0.5"
               [class]="isPipelineActive() ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'">
            <div class="w-3 sm:w-4 h-3 sm:h-4 rounded-full bg-white shadow-md transform transition-transform"
                 [class]="isPipelineActive() ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'"></div>
          </div>

          <div class="text-[10px] sm:text-xs font-bold flex items-center gap-1.5">
            @if (isPipelineActive()) {
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span class="hidden sm:inline">Pipeline: ACTIVO</span>
              <span class="sm:hidden">ACTIVO</span>
            } @else {
              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
              <span class="hidden sm:inline">Pipeline: PAUSADO</span>
              <span class="sm:hidden">PAUSADO</span>
            }
          </div>
        </button>

        <!-- SEMÁFORO DE HORARIO IDEAL EN HEADER (DISCRETO Y ACCESIBLE) -->
        <div class="relative group hidden sm:block">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all select-none cursor-help"
               [class]="goldenSlot().isActive
                 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                 : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'">
            <span class="w-2 h-2 rounded-full" [class]="goldenSlot().isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'"></span>
            <span class="font-mono">{{ peruTimeString() }}</span>
            <span class="hidden md:inline">• {{ goldenSlot().shortLabel }}</span>
          </div>

          <!-- POPOVER / TOOLTIP CON DETALLES -->
          <div class="absolute left-0 sm:left-auto sm:right-0 md:left-0 top-full mt-2 w-72 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50 text-xs space-y-2">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>⏰</span>
                <span>Horarios LinkedIn Tech</span>
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono"
                    [class]="goldenSlot().isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'">
                {{ goldenSlot().badge }}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {{ goldenSlot().description }}
            </p>
            <div class="pt-1 text-[11px] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>{{ goldenSlot().isActive ? 'Termina:' : 'Próximo pico:' }}</span>
              <span class="font-mono font-bold text-blue-600 dark:text-blue-400">{{ goldenSlot().nextSlotTime }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ACCIONES DE USUARIO Y TEMA -->
      <div class="flex items-center gap-2 sm:gap-4">

        <!-- TOGGLE MODO CLARO / OSCURO REUTILIZABLE -->
        <app-theme-toggle></app-theme-toggle>

        <!-- WIDGET DE PERFIL DE USUARIO INTERACTIVO CON MENÚ DESPLEGABLE -->
        <div class="relative pl-2 border-l border-slate-200 dark:border-slate-800" (click)="$event.stopPropagation()">
          <button (click)="toggleUserMenu()"
                  class="flex items-center gap-2 sm:gap-3 text-left p-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer select-none">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                {{ authService.currentUserSignal()?.name || 'Usuario SaaS' }}
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                {{ authService.currentUserSignal()?.email || 'dev@saas.com' }}
              </div>
            </div>
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-md shadow-blue-500/20">
              {{ getInitials(authService.currentUserSignal()?.name) }}
            </div>
          </button>

          @if (userMenuOpen()) {
            <div class="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-fadeIn text-xs">
              <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80">
                <div class="font-bold text-slate-900 dark:text-white truncate">{{ authService.currentUserSignal()?.name || 'Usuario SaaS' }}</div>
                <div class="text-[11px] text-slate-400 truncate">{{ authService.currentUserSignal()?.email || 'dev@saas.com' }}</div>
              </div>

              <div class="py-1">
                <a routerLink="/settings" (click)="userMenuOpen.set(false)"
                   class="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2.5 transition-colors">
                  <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <span>Ajustes & IA</span>
                </a>

                <a routerLink="/connections" (click)="userMenuOpen.set(false)"
                   class="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2.5 transition-colors">
                  <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                  <span>Conexiones (LinkedIn / Git)</span>
                </a>
              </div>

              <div class="border-t border-slate-100 dark:border-slate-800/80 pt-1">
                <button (click)="logout(); userMenuOpen.set(false)"
                        class="w-full text-left px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors font-semibold cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          }
        </div>

      </div>
    </header>
  `
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() toggleMobileMenu = new EventEmitter<void>();

  authService = inject(AuthService);
  private tenantService = inject(TenantService);

  isPipelineActive = signal<boolean>(true);
  currentTime = signal<Date>(new Date());
  private clockTimer: any = null;

  peruDate = computed(() => {
    const now = this.currentTime();
    try {
      const limaDateStr = now.toLocaleString('en-US', { timeZone: 'America/Lima' });
      return new Date(limaDateStr);
    } catch {
      return now;
    }
  });

  peruTimeString = computed(() => {
    const d = this.peruDate();
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const padH = String(hours).padStart(2, '0');
    const padM = String(minutes).padStart(2, '0');
    return `${padH}:${padM} ${ampm}`;
  });

  goldenSlot = computed(() => {
    const d = this.peruDate();
    const hour = d.getHours();
    const min = d.getMinutes();
    const timeInMins = hour * 60 + min;

    // Slot 1: 07:30 (450) - 09:30 (570)
    if (timeInMins >= 450 && timeInMins <= 570) {
      return {
        isActive: true,
        badge: 'FRANJA DORADA',
        shortLabel: 'Pico Café (07:30-09:30)',
        description: 'Pico #1: Desarrolladores y tech leads revisan el feed antes de la Daily.',
        nextSlotTime: '09:30 AM'
      };
    }

    // Slot 2: 12:30 (750) - 14:30 (870)
    if (timeInMins >= 750 && timeInMins <= 870) {
      return {
        isActive: true,
        badge: 'FRANJA DORADA',
        shortLabel: 'Almuerzo Móvil (12:30-14:30)',
        description: 'Pico #2: Navegación móvil durante el break. Los Micro-Posts logran +300% de retención.',
        nextSlotTime: '02:30 PM'
      };
    }

    // Slot 3: 18:00 (1080) - 20:00 (1200)
    if (timeInMins >= 1080 && timeInMins <= 1200) {
      return {
        isActive: true,
        badge: 'FRANJA DORADA',
        shortLabel: 'Fin de Jornada (18:00-20:00)',
        description: 'Pico #3: Desconexión y networking tech. Ideal para debates y preguntas de comunidad.',
        nextSlotTime: '08:00 PM'
      };
    }

    // Fuera de pico
    let nextLabel = '07:30 AM (Mañana)';
    if (timeInMins < 450) {
      nextLabel = '07:30 AM (Hoy)';
    } else if (timeInMins < 750) {
      nextLabel = '12:30 PM (Hoy)';
    } else if (timeInMins < 1080) {
      nextLabel = '06:00 PM (Hoy)';
    }

    return {
      isActive: false,
      badge: 'FUERA DE PICO',
      shortLabel: 'Fuera de Pico',
      description: 'Momento de baja interacción. Te recomendamos preparar tus posts en el Estudio o dejarlos encolados.',
      nextSlotTime: nextLabel
    };
  });

  constructor() {
    this.syncPipelineStatus();
  }

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.currentTime.set(new Date());
    }, 30000);
  }

  userMenuOpen = signal(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.userMenuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
  }

  logout(): void {
    this.authService.logout();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  syncPipelineStatus(): void {
    this.tenantService.getProfile().subscribe({
      next: (tenant) => {
        if (tenant && tenant.isEmergencyPaused !== undefined) {
          this.isPipelineActive.set(!tenant.isEmergencyPaused);
        }
      },
      error: () => {}
    });
  }

  togglePipeline(): void {
    const currentlyActive = this.isPipelineActive();
    if (currentlyActive) {
      this.tenantService.emergencyPause().subscribe({
        next: (res) => this.isPipelineActive.set(!res.isEmergencyPaused),
        error: (err) => {
          console.error('Error al pausar pipeline:', err);
          this.isPipelineActive.set(true);
        }
      });
    } else {
      this.tenantService.emergencyResume().subscribe({
        next: (res) => this.isPipelineActive.set(!res.isEmergencyPaused),
        error: (err) => {
          console.error('Error al reanudar pipeline:', err);
          this.isPipelineActive.set(false);
        }
      });
    }
  }

  getInitials(name?: string | null): string {
    if (!name) return 'US';
    return name
      .split(' ')
      .filter(n => !!n)
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}
