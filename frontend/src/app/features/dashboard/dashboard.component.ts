import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { TenantService } from '../../core/services/tenant.service';
import { PublicationService } from '../../core/services/publication.service';
import { CredentialService } from '../../core/services/credential.service';
import { DashboardStats } from '../../core/models/tenant.model';
import { PublicationLog } from '../../core/models/publication.model';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="max-w-6xl mx-auto space-y-8 animate-fadeIn">

      <!-- ENCABEZADO PRINCIPAL -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Panel General</h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Monitoreo de publicaciones automáticas y estado del sistema</p>
        </div>

        <div class="flex items-center gap-3">
          <button (click)="triggerPipeline()" [disabled]="triggering()"
                  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95">
            @if (triggering()) {
              <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Ejecutando Pipeline...</span>
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Ejecutar Publicación Ahora</span>
            }
          </button>
        </div>
      </div>

      @if (alertMessage()) {
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>{{ alertMessage() }}</span>
          </div>
          <button (click)="alertMessage.set(null)" class="text-emerald-600 dark:text-emerald-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      @if (pipelineError()) {
        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>{{ pipelineError() }}</span>
          </div>
          <button (click)="pipelineError.set(null)" class="text-rose-600 dark:text-rose-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      <!-- CENTRO DE NOTIFICACIONES & ALERTAS OPERATIVAS -->
      @if (hasAlerts()) {
        <div class="space-y-3">
          @if (!stats()?.linkedInConnected) {
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                  <div class="font-bold text-xs sm:text-sm">LinkedIn no está conectado o el token expiró</div>
                  <div class="text-[11px] sm:text-xs text-amber-700/80 dark:text-amber-300/80">Conecta tu cuenta para permitir la subida automática de publicaciones.</div>
                </div>
              </div>
              <a routerLink="/connections" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all w-fit">
                Conectar LinkedIn →
              </a>
            </div>
          }

          @if (stats()?.failedCount && stats()!.failedCount > 0) {
            <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                  <div class="font-bold text-xs sm:text-sm">{{ stats()?.failedCount }} intento(s) de publicación fallido(s)</div>
                  <div class="text-[11px] sm:text-xs text-rose-700/80 dark:text-rose-300/80">Revisa los detalles y errores en la sección de Historial.</div>
                </div>
              </div>
              <a routerLink="/publications" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all w-fit">
                Ver en Historial →
              </a>
            </div>
          }
        </div>
      }

      <!-- CHECKLIST DE ONBOARDING CON BARRA DE PROGRESO (SOLO VISIBLE SI ESTÁ INCOMPLETO) -->
      @if (onboardingProgress() < 100) {
        <div class="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-purple-900/10 dark:from-slate-900 dark:to-slate-900/80 p-5 sm:p-6 rounded-3xl border border-blue-500/20 shadow-xs space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Inicio Rápido</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400">
                  {{ onboardingProgress() }}% Completado
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pasos para activar el pipeline de publicaciones</p>
            </div>

            <div class="w-full sm:w-44 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-700"
                   [style.width.%]="onboardingProgress()"></div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            <!-- PASO 1 -->
            <a routerLink="/connections"
               class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-blue-500/60 transition-all flex items-start gap-3 group">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    [class]="stats()?.linkedInConnected ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                {{ stats()?.linkedInConnected ? '✓' : '1' }}
              </span>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">1. Conectar LinkedIn</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ stats()?.linkedInConnected ? 'Token Activo' : 'Pendiente' }}</div>
              </div>
            </a>

            <!-- PASO 2 -->
            <a routerLink="/connections"
               class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-indigo-500/60 transition-all flex items-start gap-3 group">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    [class]="gitHubConnected() ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                {{ gitHubConnected() ? '✓' : '2' }}
              </span>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors">2. Modo Proyecto</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ gitHubConnected() ? 'GitHub Monitoreado' : 'Pendiente' }}</div>
              </div>
            </a>

            <!-- PASO 3 -->
            <a routerLink="/settings"
               class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-purple-500/60 transition-all flex items-start gap-3 group">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    [class]="(stats()?.activeSchedules || 0) > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                {{ (stats()?.activeSchedules || 0) > 0 ? '✓' : '3' }}
              </span>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-500 transition-colors">3. Horarios Quartz</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ (stats()?.activeSchedules || 0) > 0 ? 'Programado' : 'Sin horario' }}</div>
              </div>
            </a>

            <!-- PASO 4 -->
            <a routerLink="/settings"
               class="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:border-amber-500/60 transition-all flex items-start gap-3 group">
              <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    [class]="promptConfigured() ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                {{ promptConfigured() ? '✓' : '4' }}
              </span>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">4. Prompt IA</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ promptConfigured() ? 'Personalidad Activa' : 'Sin configurar' }}</div>
              </div>
            </a>

          </div>
        </div>
      }

      <!-- TARJETAS KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

        <!-- CARD 1: TOTAL PUBLICACIONES -->
        <div class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Posts</span>
            <span class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{{ stats()?.totalPublications || 0 }}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span>Ejecutados en LinkedIn</span>
            <span class="text-blue-600 dark:text-blue-400 font-bold">• Acumulado</span>
          </div>
        </div>

        <!-- CARD 2: PUBLICACIONES EXITOSAS -->
        <div class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tasa de Éxito</span>
            <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{{ stats()?.successCount || 0 }}</div>
          <div class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {{ successRate() }}% de efectividad de entrega
          </div>
        </div>

        <!-- CARD 3: HORARIOS ACTIVOS -->
        <div class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Horarios Quartz</span>
            <span class="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{{ stats()?.activeSchedules || 0 }}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">Frecuencias activas programadas</div>
        </div>

        <!-- CARD 4: TOKEN LINKEDIN -->
        <div class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Vigencia Token</span>
            <span class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </span>
          </div>
          @if (stats()?.linkedInConnected) {
            <div class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {{ stats()?.linkedInDaysRemaining }} Días
              <span class="text-xs font-semibold font-mono text-slate-400">({{ tokenPercent() }}%)</span>
            </div>
            <div class="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Token Activo & Verificado</div>
          } @else {
            <div class="text-base font-bold text-amber-600 dark:text-amber-400">Desconectado</div>
            <a routerLink="/connections" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold block">Conectar ahora →</a>
          }
        </div>

      </div>

      <!-- SECCIÓN OPERATIVA: ACCESO RÁPIDO & HISTORIAL RECIENTE (VISIBLES INMEDIATAMENTE) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        <!-- TARJETA DE ESTADO OPERATIVO & ACCESOS (1 col) -->
        <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" [class]="isPipelinePaused() ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'"></span>
              <span>Estado del Pipeline</span>
            </h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  [class]="isPipelinePaused() ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'">
              {{ isPipelinePaused() ? 'PAUSADO' : 'OPERATIVO' }}
            </span>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            El sistema evalúa automáticamente commits de GitHub y temas del Banco de Ideas en tus horarios programados.
          </p>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-xs space-y-1">
            <div class="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Franja Actual:</span>
              <span class="font-mono text-blue-600 dark:text-blue-400">{{ goldenSlot().nextSlotTime }}</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              {{ goldenSlot().countdown }} • {{ goldenSlot().badge }}
            </p>
          </div>

          <div class="space-y-2 pt-1 text-xs">
            <a routerLink="/studio"
               class="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
              <span>Probar en Estudio de Contenido</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </a>

            <a routerLink="/how-it-works"
               class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span>Ver Guía de Funcionamiento</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>

        <!-- FEED ULTIMOS POSTS (2 cols) -->
        <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Últimas Publicaciones</h2>
            <a routerLink="/publications" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold">Ver Historial Completo →</a>
          </div>

          <div class="space-y-3">
            @for (log of recentLogs(); track log.id) {
              <a routerLink="/publications"
                 class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:border-blue-500/30 transition-all group block">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                       [class]="log.sourceMode === 'PROJECT' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'">
                    {{ log.sourceMode === 'PROJECT' ? 'Git' : 'Idea' }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                         [title]="log.generatedText || log.errorMessage || 'Sin texto generado'">
                      {{ log.generatedText || log.errorMessage || 'Sin texto generado' }}
                    </div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">
                      {{ log.createdAt | date:'dd/MM/yyyy HH:mm' }}
                    </div>
                  </div>
                </div>

                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold self-start sm:self-auto flex-shrink-0"
                      [class]="log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'">
                  <span class="w-1.5 h-1.5 rounded-full" [class]="log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'"></span>
                  <span>{{ log.status === 'SUCCESS' ? 'Publicado' : 'Fallido' }}</span>
                </span>
              </a>
            } @empty {
              <div class="py-12 text-center space-y-2">
                <p class="text-xs text-slate-500">Aún no se han registrado publicaciones.</p>
                <button (click)="triggerPipeline()" class="text-xs text-blue-500 font-bold hover:underline cursor-pointer">
                  Disparar publicación de prueba
                </button>
              </div>
            }
          </div>
        </div>

      </div>

      <!-- SECCIÓN COLAPSABLE: ANALÍTICA DE HORARIOS & ALCANCE SEMANAL (NO INVASIVA) -->
      <details class="group p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs transition-all">
        <summary class="flex items-center justify-between cursor-pointer list-none select-none">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              📈
            </div>
            <div>
              <div class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Distribución Semanal & Picos para Developers</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono">+300% con Micro-Posts</span>
              </div>
              <div class="text-[11px] text-slate-400">Clic para desplegar el mapa de efectividad horaria en LinkedIn</div>
            </div>
          </div>
          <span class="text-xs text-slate-400 group-open:rotate-180 transition-transform px-2">▼</span>
        </summary>

        <div class="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-fadeIn">
          <!-- GRÁFICA DE DÍAS DE LA SEMANA (LUNES A DOMINGO) -->
          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Alcance Estimado por Día</span>
              <span class="text-[10px] text-slate-400 font-normal">Martes, Miércoles y Jueves son ideales</span>
            </div>

            <div class="grid grid-cols-7 gap-2 items-end pt-2">
              @for (d of weeklyDistribution(); track d.day) {
                <div class="flex flex-col items-center gap-1.5">
                  <div class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl h-24 p-1 flex flex-col justify-end relative overflow-hidden group">
                    @if (d.isTop) {
                      <div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" title="Día Top"></div>
                    }
                    <div class="w-full rounded-lg transition-all duration-500"
                         [style.height.%]="d.heightPercent"
                         [class]="d.isCurrent ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-xs' : (d.isTop ? 'bg-indigo-500/70 hover:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700')">
                    </div>
                  </div>
                  <span class="text-[11px] font-bold"
                        [class]="d.isCurrent ? 'text-blue-600 dark:text-blue-400 font-black' : (d.isTop ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400')">
                    {{ d.day }}
                  </span>
                </div>
              }
            </div>
          </div>

          <!-- 3 FRANJAS CLAVE EN LATAM -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-center space-y-0.5">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Pico #1 (Mañana)</div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">07:30 – 09:30 AM</div>
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Café pre-Daily ☕</div>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-center space-y-0.5">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Pico #2 (Mediodía)</div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">12:30 – 02:30 PM</div>
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Almuerzo Móvil 🍲</div>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-center space-y-0.5">
              <div class="text-[10px] text-slate-400 uppercase font-semibold">Pico #3 (Tarde)</div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">06:00 – 08:00 PM</div>
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Fin de Jornada 🌆</div>
            </div>
          </div>
        </div>
      </details>

    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private publicationService = inject(PublicationService);
  private credentialService = inject(CredentialService);

  stats = signal<DashboardStats | null>(null);
  recentLogs = signal<PublicationLog[]>([]);
  triggering = signal(false);
  alertMessage = signal<string | null>(null);
  pipelineError = signal<string | null>(null);

  gitHubConnected = signal<boolean>(false);
  promptConfigured = signal<boolean>(false);
  isPipelinePaused = signal<boolean>(false);

  currentTime = signal<Date>(new Date());
  private clockTimer: any = null;

  hasAlerts = computed(() => {
    const s = this.stats();
    if (!s) return false;
    return !s.linkedInConnected || (s.failedCount > 0);
  });

  successRate = computed(() => {
    const s = this.stats();
    if (!s || !s.totalPublications) return 100;
    return Math.round((s.successCount / s.totalPublications) * 100);
  });

  tokenPercent = computed(() => {
    const s = this.stats();
    if (!s || !s.linkedInConnected) return 0;
    return Math.min(100, Math.round(((s.linkedInDaysRemaining || 0) / 60) * 100));
  });

  onboardingProgress = computed(() => {
    let score = 0;
    const s = this.stats();
    if (s?.linkedInConnected) score += 25;
    if (this.gitHubConnected()) score += 25;
    if (s?.activeSchedules && s.activeSchedules > 0) score += 25;
    if (this.promptConfigured()) score += 25;
    return score;
  });

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

  currentDayName = computed(() => {
    const d = this.peruDate();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[d.getDay()];
  });

  isTopDay = computed(() => {
    const d = this.peruDate();
    const day = d.getDay(); // 2=Mar, 3=Mié, 4=Jue
    return day === 2 || day === 3 || day === 4;
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
        badge: '🟢 FRANJA DORADA ACTIVA',
        title: 'Pico #1: Café antes de la Daily (07:30 – 09:30 AM)',
        description: 'Momento de máxima lectura en LinkedIn. Los desarrolladores revisan el feed antes de arrancar a programar.',
        nextSlotTime: 'Vigente ahora',
        countdown: 'Termina a las 09:30 AM'
      };
    }

    // Slot 2: 12:30 (750) - 14:30 (870)
    if (timeInMins >= 750 && timeInMins <= 870) {
      return {
        isActive: true,
        badge: '🟢 FRANJA DORADA ACTIVA',
        title: 'Pico #2: Almuerzo & Mobile Break (12:30 – 02:30 PM)',
        description: 'Pico de navegación móvil durante el almuerzo. Micro-posts tienen +300% de retención sin botón ...ver más.',
        nextSlotTime: 'Vigente ahora',
        countdown: 'Termina a las 02:30 PM'
      };
    }

    // Slot 3: 18:00 (1080) - 20:00 (1200)
    if (timeInMins >= 1080 && timeInMins <= 1200) {
      return {
        isActive: true,
        badge: '🟢 FRANJA DORADA ACTIVA',
        title: 'Pico #3: Fin de Jornada & Comunidad Tech (06:00 – 08:00 PM)',
        description: 'Desconexión laboral y networking. Excelente para debates técnicos y preguntas de comunidad.',
        nextSlotTime: 'Vigente ahora',
        countdown: 'Termina a las 08:00 PM'
      };
    }

    // Fuera de pico: calcular siguiente
    let nextLabel = '07:30 AM (Mañana)';
    let diff = 0;

    if (timeInMins < 450) {
      nextLabel = '07:30 AM (Hoy)';
      diff = 450 - timeInMins;
    } else if (timeInMins < 750) {
      nextLabel = '12:30 PM (Hoy)';
      diff = 750 - timeInMins;
    } else if (timeInMins < 1080) {
      nextLabel = '06:00 PM (Hoy)';
      diff = 1080 - timeInMins;
    } else {
      nextLabel = '07:30 AM (Mañana)';
      diff = (24 * 60 - timeInMins) + 450;
    }

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const countdownStr = h > 0 ? `en ${h}h ${m}m` : `en ${m} min`;

    return {
      isActive: false,
      badge: '⏳ FUERA DE PICO',
      title: 'Franja de Preparación / Encolado',
      description: 'Prepara o encola tus publicaciones para el siguiente pico de atención para garantizar mayor alcance orgánico.',
      nextSlotTime: nextLabel,
      countdown: countdownStr
    };
  });

  weeklyDistribution = computed(() => {
    const d = this.peruDate();
    const currentDayIdx = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    return [
      { day: 'Lun', heightPercent: 60, isTop: false, isCurrent: currentDayIdx === 1 },
      { day: 'Mar', heightPercent: 95, isTop: true, isCurrent: currentDayIdx === 2 },
      { day: 'Mié', heightPercent: 100, isTop: true, isCurrent: currentDayIdx === 3 },
      { day: 'Jue', heightPercent: 90, isTop: true, isCurrent: currentDayIdx === 4 },
      { day: 'Vie', heightPercent: 55, isTop: false, isCurrent: currentDayIdx === 5 },
      { day: 'Sáb', heightPercent: 35, isTop: false, isCurrent: currentDayIdx === 6 },
      { day: 'Dom', heightPercent: 40, isTop: false, isCurrent: currentDayIdx === 0 },
    ];
  });

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentLogs();
    this.loadIntegrationsState();
    this.clockTimer = setInterval(() => {
      this.currentTime.set(new Date());
    }, 30000);
  }

  loadIntegrationsState(): void {
    this.credentialService.getGitHubStatus().subscribe({
      next: (status) => this.gitHubConnected.set(!!status?.connected),
      error: () => this.gitHubConnected.set(false)
    });

    this.tenantService.getProfile().subscribe({
      next: (profile) => {
        if (profile?.systemPrompt && profile.systemPrompt.trim().length > 10) {
          this.promptConfigured.set(true);
        }
        if (profile?.isEmergencyPaused !== undefined) {
          this.isPipelinePaused.set(profile.isEmergencyPaused);
        }
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  loadStats(): void {
    this.tenantService.getDashboardStats().subscribe({
      next: (res) => this.stats.set(res),
      error: (err) => console.error('Error cargando stats:', err)
    });
  }

  loadRecentLogs(): void {
    this.publicationService.getHistory(0, 4).subscribe({
      next: (res) => this.recentLogs.set(res.content || []),
      error: (err) => console.error('Error cargando logs recientes:', err)
    });
  }

  triggerPipeline(): void {
    this.triggering.set(true);
    this.alertMessage.set(null);
    this.pipelineError.set(null);

    this.publicationService.triggerPipeline().subscribe({
      next: () => {
        this.triggering.set(false);
        this.alertMessage.set('Pipeline ejecutada exitosamente. Se ha procesado la fuente y publicado en LinkedIn.');
        this.loadStats();
        this.loadRecentLogs();
      },
      error: (err) => {
        this.triggering.set(false);
        const msg = err?.error?.message || 'Error al ejecutar la publicación. Revisa tu conexión con LinkedIn y la configuración de IA.';
        this.pipelineError.set(msg);
        console.error('Error al ejecutar pipeline:', err);
      }
    });
  }
}
