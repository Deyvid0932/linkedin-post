import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CredentialService } from '../../core/services/credential.service';
import { TenantService } from '../../core/services/tenant.service';
import { StudioService } from '../../core/services/studio.service';
import { LinkedInAccount } from '../../core/models/credential.model';
import { UserProfile } from '../../core/models/auth.model';
import { SwipeVersion, SwipeBatch, ImageAspectRatio } from '../../core/models/studio.model';

@Component({
  selector: 'app-swipe-studio',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">

      <!-- HEADER DEL ESTUDIO -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <svg class="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              <span>Estudio de Contenido</span>
            </h1>
            <a routerLink="/publications"
               title="Ver publicaciones en cola"
               class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition-colors cursor-pointer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>{{ queuedCount() }} post(s) en cola →</span>
            </a>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Genera, calibra y programa publicaciones con soporte multi-imagen para LinkedIn
          </p>
        </div>

        <!-- SELECTOR DE ORIGEN / MODO + BOTÓN GENERAR LOTE -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

          <!-- SELECTOR DE FORMATO (ANÁLISIS PRIMERO, MICRO-POST SEGUNDO, ADAPTATIVO EN MÓVIL) -->
          <div class="flex w-full sm:w-auto p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-xs">
            <button type="button" (click)="setPostFormat('DETAILED')" [disabled]="loading()"
                    [class]="postFormat() === 'DETAILED' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs ring-2 ring-indigo-500/30' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'"
                    class="flex-1 sm:w-28 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
              <span>📖</span><span>Análisis</span>
            </button>
            <button type="button" (click)="setPostFormat('MICRO')" [disabled]="loading()"
                    [class]="postFormat() === 'MICRO' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-extrabold shadow-xs ring-2 ring-blue-500/30' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'"
                    class="flex-1 sm:w-28 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50">
              <span>⚡</span><span>Micro-Post</span>
            </button>
          </div>

          <!-- BOTÓN DESPLEGABLE DE MODO (ANCHO FIJO sm:w-40 SIN LAYOUT SHIFT) -->
          <div class="relative" (click)="$event.stopPropagation()">
            <button type="button" (click)="toggleModeDropdown()" [disabled]="loading()"
                    class="w-full sm:w-40 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 shadow-xs hover:border-blue-500/50 flex items-center justify-between gap-1.5 cursor-pointer transition-all disabled:opacity-50">
              <span class="flex items-center gap-1.5 truncate">
                @if (sourceMode() === 'PROMPT') {
                  <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                } @else if (sourceMode() === 'GITHUB') {
                  <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                } @else {
                  <svg class="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                }
                <span class="truncate">{{ getModeLabel(sourceMode()) }}</span>
              </span>
              <svg class="w-3 h-3 text-slate-400 transition-transform duration-200 flex-shrink-0" [class.rotate-180]="modeDropdownOpen()" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            @if (modeDropdownOpen()) {
              <div class="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 z-30 animate-fadeIn text-xs">

                <button type="button" (click)="selectMode('IDEAS')"
                        class="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                        [class.font-bold]="sourceMode() === 'IDEAS'"
                        [class.text-amber-600]="sourceMode() === 'IDEAS'"
                        [class.dark:text-amber-400]="sourceMode() === 'IDEAS'">
                  <div class="flex items-center gap-2.5">
                    <div class="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                    </div>
                    <div>
                      <div class="font-semibold text-slate-800 dark:text-slate-200">Banco de Ideas</div>
                      <div class="text-[10px] text-slate-400 font-normal">Temas técnicos guardados</div>
                    </div>
                  </div>
                  @if (sourceMode() === 'IDEAS') { <span class="text-amber-600 dark:text-amber-400 font-bold">✓</span> }
                </button>

                <button type="button" (click)="selectMode('GITHUB')"
                        class="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                        [class.font-bold]="sourceMode() === 'GITHUB'"
                        [class.text-blue-600]="sourceMode() === 'GITHUB'"
                        [class.dark:text-blue-400]="sourceMode() === 'GITHUB'">
                  <div class="flex items-center gap-2.5">
                    <div class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                    </div>
                    <div>
                      <div class="font-semibold text-slate-800 dark:text-slate-200">Repo GitHub</div>
                      <div class="text-[10px] text-slate-400 font-normal">Commits y arquitectura de código</div>
                    </div>
                  </div>
                  @if (sourceMode() === 'GITHUB') { <span class="text-blue-600 dark:text-blue-400 font-bold">✓</span> }
                </button>

                <button type="button" (click)="selectMode('PROMPT')"
                        class="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                        [class.font-bold]="sourceMode() === 'PROMPT'"
                        [class.text-purple-600]="sourceMode() === 'PROMPT'"
                        [class.dark:text-purple-400]="sourceMode() === 'PROMPT'">
                  <div class="flex items-center gap-2.5">
                    <div class="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    </div>
                    <div>
                      <div class="font-semibold text-slate-800 dark:text-slate-200">Prompt IA</div>
                      <div class="text-[10px] text-slate-400 font-normal">Instrucciones y personalidad personalizada</div>
                    </div>
                  </div>
                  @if (sourceMode() === 'PROMPT') { <span class="text-purple-600 dark:text-purple-400 font-bold">✓</span> }
                </button>
              </div>
            }
          </div>

          <!-- BOTÓN GENERAR -->
          <button (click)="generateNewBatch()" [disabled]="loading()"
                  class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow-xs shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95 whitespace-nowrap">
            @if (loading()) {
              <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Generando...</span>
            } @else {
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Generar</span>
            }
          </button>
        </div>
      </div>

      <!-- PANEL CONTEXTUAL SEGÚN EL MODO SELECCIONADO -->
      @if (sourceMode() === 'PROMPT') {
        <div class="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 animate-fadeIn">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Configuración de System Prompt (Voz & Personalidad de la IA)</span>
                </h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Instrucciones que guían a DeepSeek al redactar tus posts técnicos en LinkedIn.</p>
              </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-auto">
              <button type="button" (click)="saveSystemPromptFromStudio()" [disabled]="savingSystemPrompt()"
                      class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                @if (savingSystemPrompt()) {
                  <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                }
                <span>Guardar Ajustes de IA</span>
              </button>
            </div>
          </div>

          <!-- TEXTAREA DEL SYSTEM PROMPT UNIFICADO -->
          <div>
            <textarea [ngModel]="systemPrompt()" (ngModelChange)="onSystemPromptChange($event)" rows="3"
                      placeholder="Define la personalidad, tono y reglas de la IA..."
                      class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 transition-all leading-relaxed font-mono"></textarea>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Caracteres: <strong class="font-mono text-slate-700 dark:text-slate-300">{{ systemPrompt().length }}</strong> / 2,000</span>
            @if (isPromptDirty()) {
              <span class="text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-semibold animate-pulse">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>Cambios sin guardar (haz clic en Guardar)</span>
              </span>
            } @else {
              <span class="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Sincronizado con Ajustes de IA ✓</span>
              </span>
            }
          </div>
        </div>
      }

      @if (alertMessage()) {
        <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>{{ alertMessage() }}</span>
          </div>
          <button (click)="alertMessage.set(null)" class="text-emerald-600 dark:text-emerald-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      @if (genericError()) {
        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 animate-fadeIn">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>{{ genericError() }}</span>
          </div>
          <button (click)="genericError.set(null)" class="text-rose-600 dark:text-rose-400 hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      @if (aiConfigError()) {
        <!-- CARD DE ESTADO VACÍO (TU IA NO ESTÁ CONFIGURADA TODAVÍA) -->
        <div class="p-10 sm:p-14 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto space-y-4 my-6 animate-fadeIn">
          <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="space-y-1">
            <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Tu IA no está configurada todavía</h3>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Para generar publicaciones técnicas y de alto impacto, configura tu API Key y la personalidad de tu IA.
            </p>
          </div>
          <div class="pt-2">
            <a routerLink="/settings"
               class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer">
              <span>Ir a Ajustes → Automatización & IA</span>
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </a>
          </div>
        </div>
      } @else if (loading()) {
        <!-- SKELETON LOADING -->
        <div class="p-12 sm:p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div class="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div class="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
            Generando variante de contenido técnico con DeepSeek...
          </div>
          <p class="text-xs text-slate-400">Optimizando ganchos y estructurando conceptos clave para LinkedIn.</p>
        </div>
      } @else if (batch() && currentVersion()) {

        <!-- SELECTOR DE VERSIÓN A / B / C CON TABS ESTABLES (GRID COLS 3) -->
        <div class="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 w-full">
          @for (v of batch()?.versions; track v.id; let i = $index) {
            <button (click)="selectVersionIndex(i)"
                    [disabled]="tabGeneratingIndex() === i"
                    [class]="currentIndex() === i ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium'"
                    class="w-full py-2 px-2 rounded-lg text-xs transition-all text-center truncate cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-80">
              @if (tabGeneratingIndex() === i) {
                <span class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></span>
                <span class="truncate text-blue-600 dark:text-blue-400 font-bold">Cargando...</span>
              } @else {
                <span class="truncate">{{ v.tituloEstructura }}</span>
                @if (v.textoGenerado) {
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Generado"></span>
                }
              }
            </button>
          }
        </div>

        <!-- BARRA DE TELEMETRÍA LIMPIA -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs text-xs">

          <!-- LONGITUD -->
          <div class="space-y-1">
            <div class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold flex items-center justify-between">
              <span>Longitud:</span>
              <div class="flex items-center gap-1.5">
                @if (postFormat() === 'MICRO' && textMetrics().charCount <= 650) {
                  <span class="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">⚡ Zero Fricción</span>
                }
                <span [class]="charCountStatus().color" class="font-bold font-mono">{{ textMetrics().charCount }} / {{ postFormat() === 'MICRO' ? '650' : '1,500' }}</span>
              </div>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300"
                   [style.width.%]="charCountPercentage()"
                   [class]="charCountStatus().barColor"></div>
            </div>
          </div>

          <!-- TIEMPO DE LECTURA -->
          <div class="space-y-0.5 border-l pl-3 border-slate-200 dark:border-slate-800">
            <div class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">Tiempo Lectura:</div>
            <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">~{{ textMetrics().readingTimeSec }} seg</div>
          </div>

          <!-- ÍNDICE DE CLARIDAD -->
          <div class="space-y-0.5 border-l pl-3 border-slate-200 dark:border-slate-800"
               title="Mide densidad de oraciones concisas, uso de viñetas y legibilidad para LinkedIn">
            <div class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold flex items-center gap-1 cursor-help">
              <span>Score Claridad:</span>
              <span class="text-[10px] text-slate-400">ℹ️</span>
            </div>
            <div class="font-bold font-mono text-sm"
                 [class]="textMetrics().clarityScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : (textMetrics().clarityScore >= 50 ? 'text-amber-500' : 'text-rose-500')">
              {{ textMetrics().clarityScore }}/100
            </div>
          </div>

          <!-- IMÁGENES ADJUNTAS -->
          <div class="space-y-0.5 border-l pl-3 border-slate-200 dark:border-slate-800">
            <div class="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">Fotos Adjuntas:</div>
            <div class="font-bold text-slate-900 dark:text-white font-mono text-sm">
              {{ currentImages().length }} / 4 foto(s)
            </div>
          </div>

        </div>

        <!-- TARJETA PRINCIPAL TIPO POST LINKEDIN -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">

          <!-- 1. HEADER LINKEDIN CON AVATAR, VERIFICACIÓN, HEADLINE EDITABLE Y FECHA RELATIVA -->
          <div class="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div class="flex items-center gap-3">
              <!-- AVATAR CON BADGE DE VERIFICACIÓN -->
              <div class="relative">
                <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-base shadow-md">
                  {{ userInitials() }}
                </div>
                <div class="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-slate-900"
                     title="Verificado en LinkedIn">
                  ✓
                </div>
              </div>

              <!-- NOMBRE, HEADLINE EDITABLE Y FECHA RELATIVA -->
              <div class="space-y-0.5">
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                    {{ userName() }}
                  </span>
                  <span class="text-xs text-slate-400 font-normal">• 1er</span>
                </div>

                <!-- HEADLINE EDITABLE -->
                @if (isEditingHeadline()) {
                  <div class="flex items-center gap-1.5 pt-0.5">
                    <input [(ngModel)]="userHeadline"
                           (blur)="isEditingHeadline.set(false)"
                           (keyup.enter)="isEditingHeadline.set(false)"
                           placeholder="Escribe tu headline..."
                           class="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-indigo-500/50 text-slate-900 dark:text-white w-64 focus:outline-none" />
                    <button (click)="isEditingHeadline.set(false)" class="text-xs text-indigo-600 font-bold px-1.5 py-0.5 cursor-pointer">Listo</button>
                  </div>
                } @else {
                  <div class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 group cursor-pointer"
                       (click)="isEditingHeadline.set(true)"
                       title="Haz clic para editar tu titular de LinkedIn">
                    <span class="truncate max-w-[240px] sm:max-w-md">{{ userHeadline() }}</span>
                    <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 text-indigo-500 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </div>
                }

                <!-- FECHA RELATIVA LINKEDIN -->
                <div class="text-[11px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                  <span>Publicado hace 2 min</span>
                  <span>•</span>
                  <svg class="w-3.5 h-3.5 text-slate-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Público en LinkedIn"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
              </div>
            </div>

            <!-- CONTROLES SUPERIORES (MODO FEED VS MODO COMPLETO & EDITAR) -->
            <div class="flex items-center gap-1.5">
              <button (click)="toggleFeedTruncation()"
                      [class]="isFeedTruncated() ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'"
                      class="px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 cursor-pointer"
                      title="Simular corte en feed con ...ver más">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <span>{{ isFeedTruncated() ? 'Vista Feed' : 'Texto Completo' }}</span>
              </button>

              <button (click)="isEditing.set(!isEditing())"
                      [class]="isEditing() ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'"
                      class="px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer">
                @if (isEditing()) {
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  <span>Ver Preview</span>
                } @else {
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  <span>Editar</span>
                }
              </button>
            </div>
          </div>

          <!-- 2. CONTENIDO DEL POST (TEXTO CON TRUNCADO INTELIGENTE O MODO EDICIÓN) -->
          @if (isEditing()) {
            <div class="space-y-3 animate-fadeIn">
              <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span>Editor de Texto en Vivo:</span>
                <span class="font-mono text-[11px]">{{ currentVersion()?.textoGenerado?.length || 0 }} caracteres</span>
              </div>
              <textarea
                [ngModel]="currentVersion()?.textoGenerado"
                (ngModelChange)="updateCurrentText($event)"
                rows="10"
                class="w-full p-4 text-xs sm:text-sm rounded-2xl bg-slate-50 dark:bg-slate-950 border border-indigo-500/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 leading-relaxed resize-y font-sans shadow-inner"
                placeholder="Escribe o edita el contenido del post..."></textarea>
            </div>
          } @else if (tabGeneratingIndex() === currentIndex() || (!currentVersion()?.textoGenerado && !loading())) {
            <!-- ESTADO DE CARGA DE LA VARIANTE BAJO DEMANDA -->
            <div class="py-12 px-6 text-center space-y-3 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl border border-dashed border-blue-500/30 animate-pulse">
              <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div class="space-y-1">
                <div class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Generando {{ currentVersion()?.tituloEstructura || 'esta variante' }} con IA...
                </div>
                <p class="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Redactando bajo demanda para ahorrar tokens. Tomará unos segundos...
                </p>
              </div>
            </div>
          } @else {
            <div class="text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-relaxed font-sans select-text">
              @if (postFormat() === 'MICRO' && textMetrics().charCount <= 650) {
                <!-- MICRO-POST SNACKABLE: 100% VISIBLE EN PANTALLA MÓVIL SIN BOTÓN ...VER MÁS -->
                <div class="whitespace-pre-line text-slate-800 dark:text-slate-200">
                  {{ currentVersion()?.textoGenerado }}
                </div>
              } @else if (isFeedTruncated() && !isExpanded()) {
                <!-- TEXTO TRUNCADO A 3 LÍNEAS -->
                <div class="space-y-2">
                  <div class="line-clamp-3 whitespace-pre-line text-slate-800 dark:text-slate-200">
                    {{ currentVersion()?.textoGenerado }}
                  </div>
                  <button (click)="isExpanded.set(true)"
                          class="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer text-xs">
                    ...ver más
                  </button>
                </div>
              } @else {
                <!-- TEXTO EXPANDIDO COMPLETO -->
                <div class="whitespace-pre-line text-slate-800 dark:text-slate-200">
                  {{ currentVersion()?.textoGenerado }}
                </div>
                @if (isFeedTruncated() && isExpanded()) {
                  <button (click)="isExpanded.set(false)"
                          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold mt-2 hover:underline cursor-pointer block">
                    ▲ Ver menos (replegar gancho)
                  </button>
                }
              }
            </div>
          }

          <!-- 3. SECCIÓN MULTI-IMAGEN (GALERÍA LINKEDIN & CARGA) -->
          <div class="pt-2 space-y-3">
            <input #multiFileInput type="file" accept="image/*" multiple (change)="onMultipleFilesSelected($event)" class="hidden" />

            @if (currentImages().length > 0) {
              <!-- GALERÍA MULTI-IMAGEN LINKEDIN -->
              <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">

                @if (currentImages().length === 1) {
                  <!-- 1 SOLA IMAGEN (FULL WIDTH) -->
                  <div class="relative group w-full max-h-[420px] flex items-center justify-center bg-slate-900">
                    <img [src]="currentImages()[0]" alt="Imagen del post" class="w-full h-auto max-h-[420px] object-cover" />
                    <div class="absolute top-3 right-3 flex items-center gap-2">
                      <button (click)="multiFileInput.click()" title="Reemplazar imagen"
                              class="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-md">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      </button>
                      <button (click)="removeImage(0)" title="Eliminar imagen"
                              class="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-md">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                } @else if (currentImages().length === 2) {
                  <!-- 2 IMÁGENES (2 COLUMNAS) -->
                  <div class="grid grid-cols-2 gap-1 bg-slate-900 max-h-[380px]">
                    @for (img of currentImages(); track $index; let i = $index) {
                      <div class="relative group h-64 overflow-hidden">
                        <img [src]="img" alt="Foto {{ i + 1 }}" class="w-full h-full object-cover" />
                        <button (click)="removeImage(i)" title="Eliminar imagen"
                                class="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    }
                  </div>
                } @else if (currentImages().length === 3) {
                  <!-- 3 IMÁGENES (1 GRANDE + 2 COLUMNA) -->
                  <div class="grid grid-cols-2 gap-1 bg-slate-900 max-h-[380px]">
                    <div class="relative group h-64 overflow-hidden">
                      <img [src]="currentImages()[0]" alt="Foto 1" class="w-full h-full object-cover" />
                      <button (click)="removeImage(0)" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div class="grid grid-rows-2 gap-1 h-64">
                      @for (img of currentImages().slice(1, 3); track $index; let i = $index) {
                        <div class="relative group h-31.5 overflow-hidden">
                          <img [src]="img" alt="Foto {{ i + 2 }}" class="w-full h-full object-cover" />
                          <button (click)="removeImage(i + 1)" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <!-- 4 IMÁGENES (GRID 2x2) -->
                  <div class="grid grid-cols-2 gap-1 bg-slate-900 max-h-[380px]">
                    @for (img of currentImages().slice(0, 4); track $index; let i = $index) {
                      <div class="relative group h-36 overflow-hidden">
                        <img [src]="img" alt="Foto {{ i + 1 }}" class="w-full h-full object-cover" />
                        <button (click)="removeImage(i)" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- BARRA DE MINIATURAS Y ACCIONES DE FOTOS -->
              <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-slate-400 font-semibold">{{ currentImages().length }} imagen(es) seleccionada(s)</span>
                  @if (currentImages().length < 4) {
                    <button (click)="multiFileInput.click()"
                            class="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-100 transition-colors flex items-center gap-1 cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                      <span>Añadir otra foto</span>
                    </button>
                  }
                </div>
                <button (click)="clearAllImages()" class="text-rose-500 hover:underline font-semibold cursor-pointer">
                  Eliminar todas
                </button>
              </div>

            } @else {
              <!-- DROPZONE DE CARGA INICIAL -->
              <div (click)="multiFileInput.click()"
                   (dragover)="onDragOver($event)"
                   (dragleave)="onDragLeave($event)"
                   (drop)="onFileDrop($event)"
                   [class]="isDragging() ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40' : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'"
                   class="border-2 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2">
                <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span class="text-blue-600 dark:text-blue-400 underline">Haz clic para subir una o varias fotos</span> o arrastra archivos aquí
                </div>
                <div class="text-[11px] text-slate-400">
                  Soporta hasta 4 imágenes por publicación (PNG, JPG, WEBP)
                </div>
              </div>
            }
          </div>

          <!-- 4. BOTONES DE EVALUACIÓN (SWIPE) -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">

            <!-- SELECTOR DE DESTINO LINKEDIN MULTI-CUENTA -->
            @if (enabledAccounts().length > 1) {
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div class="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Publicar en LinkedIn como:</span>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  @for (acc of enabledAccounts(); track acc.id) {
                    <button type="button"
                            (click)="selectedTargetId.set(acc.id)"
                            [class]="selectedTargetId() === acc.id ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'"
                            class="px-2.5 py-1 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-[11px]">
                      @if (acc.accountType === 'PERSON') {
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                      } @else {
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      }
                      <span>{{ acc.displayName }}</span>
                    </button>
                  }
                </div>
              </div>
            }

            @if (buttonFeedbackNotice()) {
              <div class="p-3 rounded-xl bg-slate-900/90 dark:bg-slate-800 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
                <span>{{ buttonFeedbackNotice() }}</span>
                <span class="text-xs text-slate-400 animate-pulse">Siguiente tema ⏳</span>
              </div>
            }

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button (click)="sendFeedback(-1)" [disabled]="submitting() || loading()"
                      class="py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                @if (submitting() && activeAction() === -1) {
                  <span class="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></span>
                }
                <span>Descartar Lote (-1)</span>
              </button>

              <button (click)="sendFeedback(1)" [disabled]="submitting() || loading() || !currentVersion()?.textoGenerado"
                      class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs shadow-sm shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
                @if (submitting() && activeAction() === 1) {
                  <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                }
                <span>Aprobar este Formato (+1)</span>
              </button>
            </div>
          </div>


        </div>
      }
    </div>
  `
})
export class SwipeStudioComponent implements OnInit {
  private studioService = inject(StudioService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private credentialService = inject(CredentialService);
  private tenantService = inject(TenantService);

  accounts = signal<LinkedInAccount[]>([]);
  enabledAccounts = computed(() => this.accounts().filter(a => a.isEnabled));
  selectedTargetId = signal<string | null>(null);
  variantLoading = signal(false);

  // Selector de Formato de Post: arranca en DETAILED (Análisis)
  postFormat = signal<'MICRO' | 'DETAILED'>('DETAILED');

  // Estados dedicados de error
  aiConfigError = signal(false);
  genericError = signal<string | null>(null);

  // Loading local por pestaña para no bloquear todo el componente
  tabGeneratingIndex = signal<number | null>(null);

  // Selector de Modo de Generación: 'IDEAS' (Banco de Ideas), 'PROMPT' (Personalidad & System Prompt), 'GITHUB' (Repositorio)
  sourceMode = signal<'PROMPT' | 'GITHUB' | 'IDEAS'>('IDEAS');
  modeDropdownOpen = signal(false);
  systemPrompt = signal<string>('Eres Deyvid Jair Chupillon Silva, Desarrollador Junior Frontend/Fullstack apasionado por Spring Boot, Angular y la arquitectura de software moderna. Genera posts con tono profesional, conciso, ejemplos técnicos claros y llamadas a la acción.');
  tenantTimezone = signal<string>('America/Lima');
  savingSystemPrompt = signal(false);
  isPromptDirty = signal(false);

  loading = signal(false);
  imageLoading = signal(true);
  submitting = signal(false);
  activeAction = signal<number | null>(null);
  buttonFeedbackNotice = signal<string | null>(null);
  isEditing = signal(false);
  isEditingHeadline = signal(false);
  isFeedTruncated = signal(true);
  isExpanded = signal(false);
  batch = signal<SwipeBatch | null>(null);
  currentIndex = signal(0);
  alertMessage = signal<string | null>(null);
  queuedCount = signal<number>(0);

  // Formato de aspect ratio de imagen
  aspectRatio = signal<ImageAspectRatio>('16:9');

  // Headline editable del usuario
  userHeadline = signal<string>('Senior Software Engineer | Spring Boot 4 & Angular 22 | Cloud & AI Systems');

  // Estado para drag & drop y carga de archivos locales
  isDragging = signal(false);
  customImageFileName = signal<string | null>(null);

  // Mapa de semillas por versión para que cada cambio de ángulo tenga una imagen distinta
  private versionSeeds = signal<{ [versionId: string]: number }>({});

  userName = computed(() => (this.authService.currentUserSignal() as UserProfile | null)?.name || 'Deyvid Dev');

  userInitials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  });

  currentVersion = computed<SwipeVersion | null>(() => {
    const b = this.batch();
    if (!b || !b.versions || !b.versions.length) return null;
    const idx = this.currentIndex();
    return b.versions[idx] || b.versions[0];
  });

  // Métricas dinámicas en tiempo real del texto
  textMetrics = computed(() => {
    const text = this.currentVersion()?.textoGenerado || '';
    const charCount = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const readingTimeSec = Math.max(5, Math.round((words / 200) * 60));
    const hashtagCount = (text.match(/#[a-zA-Z0-9_]+/g) || []).length;
    const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;

    let clarity = 95;
    if (charCount < 600) clarity -= 10;
    if (charCount > 2200) clarity -= 15;
    if (hashtagCount > 7) clarity -= 10;

    return {
      charCount,
      words,
      readingTimeSec,
      hashtagCount,
      emojiCount,
      clarityScore: Math.max(50, Math.min(99, clarity))
    };
  });

  charCountPercentage = computed(() => {
    const count = this.textMetrics().charCount;
    const base = this.postFormat() === 'MICRO' ? 650 : 1500;
    return Math.min(100, Math.round((count / base) * 100));
  });

  charCountStatus = computed(() => {
    const count = this.textMetrics().charCount;
    if (this.postFormat() === 'MICRO') {
      if (count < 350) {
        return { label: 'Breve (<350 chars)', color: 'text-amber-500', barColor: 'bg-amber-500' };
      }
      if (count <= 650) {
        return { label: 'Óptimo Micro-Post (400 - 650 chars sin ...ver más)', color: 'text-emerald-500', barColor: 'bg-emerald-500' };
      }
      if (count <= 900) {
        return { label: 'Extenso para Micro-Post (>650 chars)', color: 'text-blue-500', barColor: 'bg-blue-500' };
      }
      return { label: 'Excede formato Snackable (>900 chars)', color: 'text-rose-500', barColor: 'bg-rose-500' };
    }

    // Modo DETAILED (Análisis Técnico 1,000 - 1,500 chars)
    if (count < 900) {
      return { label: 'Breve (<900 chars)', color: 'text-amber-500', barColor: 'bg-amber-500' };
    }
    if (count <= 1800) {
      return { label: 'Óptimo Técnico (1,000 - 1,800 chars para LinkedIn)', color: 'text-emerald-500', barColor: 'bg-emerald-500' };
    }
    if (count <= 2500) {
      return { label: 'Extenso (1,800 - 2,500 chars)', color: 'text-blue-500', barColor: 'bg-blue-500' };
    }
    return { label: 'Cerca del límite (>2,500 chars)', color: 'text-rose-500', barColor: 'bg-rose-500' };
  });

  // Lista de imágenes de la versión activa (soporta múltiples hasta 4)
  currentImages = computed<string[]>(() => {
    const v = this.currentVersion();
    if (!v) return [];
    if (v.imageUrls && v.imageUrls.length > 0) return v.imageUrls;
    if (v.imageUrl && v.imageUrl.trim().length > 0) return [v.imageUrl];
    return [];
  });

  // Indicador de si la versión actual cuenta con imagen cargada
  hasImage = computed<boolean>(() => {
    const v = this.currentVersion();
    return !!(v && (v.imageUrl || (v.imageUrls && v.imageUrls.length > 0)));
  });

  // URL dinámica: devuelve la imagen personalizada o cargada por el usuario (o null si no hay imagen)
  activeImageUrl = computed<string | null>(() => {
    const imgs = this.currentImages();
    return imgs.length > 0 ? imgs[0] : null;
  });


  private readonly STORAGE_KEY = 'swipe_studio_active_state_v2';

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeModeDropdown();
  }

  toggleModeDropdown(): void {
    this.modeDropdownOpen.set(!this.modeDropdownOpen());
  }

  closeModeDropdown(): void {
    this.modeDropdownOpen.set(false);
  }

  selectMode(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): void {
    this.closeModeDropdown();
    if (this.sourceMode() === mode || this.loading()) return;
    this.setSourceMode(mode);
    this.generateNewBatch();
  }

  getModeLabel(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): string {
    switch (mode) {
      case 'PROMPT': return 'Prompt IA';
      case 'GITHUB': return 'Repo GitHub';
      case 'IDEAS': return 'Banco de Ideas';
    }
  }

  setPostFormat(format: 'MICRO' | 'DETAILED'): void {
    if (this.postFormat() === format || this.loading()) return;
    this.postFormat.set(format);
    this.saveStudioState();
    this.generateNewBatch();
  }

  saveStudioState(): void {
    try {
      const state = {
        batch: this.batch(),
        currentIndex: this.currentIndex(),
        postFormat: this.postFormat(),
        sourceMode: this.sourceMode(),
        systemPrompt: this.systemPrompt(),
        userHeadline: this.userHeadline(),
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('No se pudo guardar el estado local del estudio:', e);
    }
  }

  loadStudioState(): boolean {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (state && state.batch && state.batch.versions && state.batch.versions.length > 0) {
        this.batch.set(state.batch);
        this.currentIndex.set(typeof state.currentIndex === 'number' ? state.currentIndex : 0);
        if (state.postFormat) this.postFormat.set(state.postFormat);
        if (state.sourceMode) this.sourceMode.set(state.sourceMode);
        if (state.systemPrompt) this.systemPrompt.set(state.systemPrompt);
        if (state.userHeadline) this.userHeadline.set(state.userHeadline);
        return true;
      }
    } catch (e) {
      console.warn('Error al restaurar estado guardado del estudio:', e);
    }
    return false;
  }

  ngOnInit(): void {
    this.loadLinkedInAccounts();
    this.loadQueueCount();
    this.loadTenantSystemPrompt();

    this.route.queryParams.subscribe((params) => {
      if (params['repo']) {
        this.sourceMode.set('GITHUB');
        this.generateBatchForRepo(params['repo']);
      } else if (params['topic']) {
        this.sourceMode.set('IDEAS');
        this.generateBatchForCustomTopic(params['topic']);
      } else {
        const restored = this.loadStudioState();
        if (!restored) {
          this.generateNewBatch();
        }
      }
    });
  }

  loadTenantSystemPrompt(): void {
    this.tenantService.getProfile().subscribe({
      next: (profile) => {
        if (profile?.systemPrompt) {
          this.systemPrompt.set(profile.systemPrompt);
        }
        if (profile?.timezone) {
          this.tenantTimezone.set(profile.timezone);
        }
      },
      error: () => {}
    });
  }

  onSystemPromptChange(newVal: string): void {
    this.systemPrompt.set(newVal);
    this.isPromptDirty.set(true);
    this.saveStudioState();
  }

  saveSystemPromptFromStudio(): void {
    this.savingSystemPrompt.set(true);
    this.tenantService.updateProfile({
      systemPrompt: this.systemPrompt(),
      timezone: this.tenantTimezone()
    }).subscribe({
      next: () => {
        this.savingSystemPrompt.set(false);
        this.isPromptDirty.set(false);
        this.alertMessage.set('✨ Personalidad y System Prompt de la IA guardados exitosamente.');
        this.saveStudioState();
      },
      error: () => {
        this.savingSystemPrompt.set(false);
        this.alertMessage.set('No se pudo guardar el System Prompt.');
      }
    });
  }

  setSourceMode(mode: 'PROMPT' | 'GITHUB' | 'IDEAS'): void {
    this.sourceMode.set(mode);
    this.saveStudioState();
  }

  loadQueueCount(): void {
    this.studioService.getQueueCount().subscribe({
      next: (res) => this.queuedCount.set(res?.queueCount || 0),
      error: () => {}
    });
  }

  loadLinkedInAccounts(): void {
    this.credentialService.getLinkedInAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs || []);
        const enabled = (accs || []).filter(a => a.isEnabled);
        const primary = enabled.find(a => a.isPrimary) || enabled[0];
        if (primary) {
          this.selectedTargetId.set(primary.id);
        }
      },
      error: () => {}
    });
  }


  generateBatchForRepo(repoName: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    this.studioService.fetchSwipeBatch('GITHUB', undefined, repoName, true, this.postFormat()).subscribe({
      next: (data) => {
        this.batch.set(data);
        this.currentIndex.set(0);
        this.loading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.loading.set(false);
        this.handleGenerationError(err);
      }
    });
  }

  generateBatchForCustomTopic(topicTitle: string): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    this.studioService.fetchSwipeBatch('RESEARCH', topicTitle, undefined, true, this.postFormat()).subscribe({
      next: (data) => {
        this.batch.set(data);
        this.currentIndex.set(0);
        this.loading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.loading.set(false);
        this.handleGenerationError(err);
      }
    });
  }

  generateNewBatch(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.aiConfigError.set(false);
    this.genericError.set(null);
    this.alertMessage.set(null);
    this.isEditing.set(false);
    this.isExpanded.set(false);
    this.imageLoading.set(true);

    const mode = this.sourceMode();
    const promptVal = mode === 'PROMPT' ? this.systemPrompt() : undefined;
    const format = this.postFormat();

    this.studioService.fetchSwipeBatch(mode, promptVal, undefined, true, format).subscribe({
      next: (batch) => {
        this.batch.set(batch);
        this.currentIndex.set(0);
        this.loading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.loading.set(false);
        this.handleGenerationError(err);
      }
    });
  }

  selectVersionIndex(index: number): void {
    this.currentIndex.set(index);
    this.imageLoading.set(true);
    this.isExpanded.set(false);

    const currentBatch = this.batch();
    const v = currentBatch?.versions?.[index];

    // Si la variante ya tiene texto (ya fue generada), no hacemos llamada HTTP
    if (!v || v.textoGenerado?.trim()) {
      this.saveStudioState();
      return;
    }

    // Si no tiene texto, se genera bajo demanda
    this.tabGeneratingIndex.set(index);
    const approach = v.estructuraUsada || 'COMPARATIVE_B2B';
    const mode = this.sourceMode();
    const promptVal = mode === 'PROMPT' ? this.systemPrompt() : (mode === 'IDEAS' ? this.batch()?.topicTitle : undefined);
    const repoName = mode === 'GITHUB' ? (this.batch()?.topicTitle || undefined) : undefined;
    const format = this.postFormat();

    this.studioService.fetchSingleVersion(approach, mode, promptVal, repoName, format).subscribe({
      next: (versionData) => {
        this.updateVersionInBatch(index, versionData);
        this.tabGeneratingIndex.set(null);
        this.saveStudioState();
      },
      error: (err) => {
        this.tabGeneratingIndex.set(null);
        this.handleGenerationError(err);
      }
    });
  }

  generateCurrentVariant(): void {
    const cur = this.currentVersion();
    if (!cur) return;
    const idx = this.currentIndex();
    const approach = cur.estructuraUsada || 'COMPARATIVE_B2B';
    this.variantLoading.set(true);
    this.genericError.set(null);

    const mode = this.sourceMode();
    const promptVal = mode === 'PROMPT' ? this.systemPrompt() : (mode === 'IDEAS' ? this.batch()?.topicTitle : undefined);
    const repoName = mode === 'GITHUB' ? (this.batch()?.topicTitle || undefined) : undefined;
    const format = this.postFormat();

    this.studioService.fetchSingleVersion(approach, mode, promptVal, repoName, format).subscribe({
      next: (versionData) => {
        this.updateVersionInBatch(idx, versionData);
        this.variantLoading.set(false);
        this.saveStudioState();
      },
      error: (err) => {
        this.variantLoading.set(false);
        this.handleGenerationError(err);
      }
    });
  }

  private updateVersionInBatch(index: number, versionData: SwipeVersion): void {
    const curBatch = this.batch();
    if (!curBatch || !curBatch.versions) return;
    const updatedVersions = [...curBatch.versions];
    if (index >= 0 && index < updatedVersions.length) {
      updatedVersions[index] = {
        ...updatedVersions[index],
        textoGenerado: versionData.textoGenerado,
        imageUrl: versionData.imageUrl || updatedVersions[index].imageUrl,
        tokensUsed: versionData.tokensUsed,
        costUsd: versionData.costUsd,
        percentMonthlyCredit: versionData.percentMonthlyCredit
      };
      this.batch.set({
        ...curBatch,
        versions: updatedVersions
      });
    }
  }

  private handleGenerationError(err: any): void {
    if (err?.status === 424 || err?.error?.errorCode === 'AI_NOT_CONFIGURED') {
      this.aiConfigError.set(true);
    } else {
      const msg = err?.error?.message || 'Error al conectar con la IA. Inténtalo de nuevo.';
      this.genericError.set(msg);
      this.alertMessage.set('❌ ' + msg);
    }
  }

  toggleFeedTruncation(): void {
    this.isFeedTruncated.set(!this.isFeedTruncated());
    this.isExpanded.set(false);
  }

  setAspectRatio(ratio: ImageAspectRatio): void {
    this.aspectRatio.set(ratio);
    this.imageLoading.set(true);
  }

  getAspectRatioClass(): string {
    switch (this.aspectRatio()) {
      case '1:1':
        return 'aspect-square max-w-[440px] mx-auto';
      case '4:5':
        return 'aspect-[4/5] max-w-[400px] mx-auto';
      case '16:9':
      default:
        return 'aspect-video max-h-[380px] sm:max-h-[440px]';
    }
  }

  getResolutionLabel(): string {
    switch (this.aspectRatio()) {
      case '1:1':
        return '1080 × 1080 (Cuadrado)';
      case '4:5':
        return '1080 × 1350 (Retrato)';
      case '16:9':
      default:
        return '1200 × 630 (Banner)';
    }
  }

  regenerateCurrentVersionImage(): void {
    const v = this.currentVersion();
    const b = this.batch();
    if (!v) return;

    this.imageLoading.set(true);
    const query = b?.topicTitle || 'data analytics dashboard';

    this.studioService.searchImage(query).subscribe({
      next: (res) => {
        if (res && res.imageUrl) {
          this.updateCurrentVersionImages([res.imageUrl]);
        }
        this.imageLoading.set(false);
      },
      error: () => {
        this.imageLoading.set(false);
      }
    });
  }

  onImageLoaded(): void {
    this.imageLoading.set(false);
  }

  onImageError(): void {
    this.imageLoading.set(false);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleMultipleFiles(files);
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleMultipleFiles(input.files);
    }
  }

  onMultipleFilesSelected(event: Event): void {
    this.onFileInputChange(event);
  }

  handleMultipleFiles(files: FileList | File[]): void {
    const fileList = Array.from(files).slice(0, 4);
    const currentImgs = [...this.currentImages()];

    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      if (currentImgs.length >= 4) break;

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && currentImgs.length < 4) {
          currentImgs.push(result);
          this.updateCurrentVersionImages([...currentImgs]);
        }
      };
      reader.readAsDataURL(file);
    }
    this.alertMessage.set('Fotos añadidas correctamente.');
  }

  removeImage(index: number): void {
    const updated = [...this.currentImages()];
    updated.splice(index, 1);
    this.updateCurrentVersionImages(updated);
  }

  clearAllImages(): void {
    this.updateCurrentVersionImages([]);
  }

  updateCurrentText(newText: string): void {
    const b = this.batch();
    if (!b || !b.versions.length) return;
    const versions = [...b.versions];
    versions[this.currentIndex()] = {
      ...versions[this.currentIndex()],
      textoGenerado: newText
    };
    this.batch.set({ ...b, versions });
    this.saveStudioState();
  }

  updateCurrentVersionImages(images: string[]): void {
    const b = this.batch();
    if (!b || !b.versions.length) return;
    const versions = [...b.versions];
    versions[this.currentIndex()] = {
      ...versions[this.currentIndex()],
      imageUrl: images[0] || '',
      imageUrls: images
    };
    this.batch.set({ ...b, versions });
    this.saveStudioState();
  }

  sendFeedback(score: number): void {
    if (this.submitting()) return;

    const v = this.currentVersion();
    const b = this.batch();
    if (!v || !b) return;

    if (score === 1 && (!v.textoGenerado || v.textoGenerado.trim().length < 50)) {
      this.alertMessage.set('⚠️ Primero debes generar el contenido de esta variante con el botón de DeepSeek antes de aprobar.');
      return;
    }

    this.submitting.set(true);
    this.activeAction.set(score);
    this.alertMessage.set(null);
    this.buttonFeedbackNotice.set(null);

    const imgs = this.currentImages();
    const selectedAcc = this.accounts().find(a => a.id === this.selectedTargetId());

    const body = {
      textoGenerado: v.textoGenerado,
      tema: b.topicTitle,
      puntajeUsuario: score,
      estructuraUsada: v.estructuraUsada,
      sourceMode: b.sourceMode,
      imageUrl: imgs[0] || null,
      imageUrls: imgs,
      tokensUsed: v.tokensUsed,
      costUsd: v.costUsd,
      targetCredentialId: this.selectedTargetId(),
      targetAccountType: selectedAcc?.accountType
    };

    this.studioService.sendFeedback(body as any).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.activeAction.set(null);
        this.handleFeedbackSuccess(score, res);
      },
      error: () => {
        this.submitting.set(false);
        this.activeAction.set(null);
        this.alertMessage.set('No se pudo procesar la solicitud en este momento.');
      }
    });
  }

  private handleFeedbackSuccess(score: number, res?: any): void {
    let notice = '';
    if (score === 1) {
      const count = res?.queuedCount ?? (this.queuedCount() + 1);
      this.queuedCount.set(count);
      this.alertMessage.set(res?.message || `¡Post aprobado y programado! (${count} en cola)`);
      notice = `¡Post aprobado y encolado (#${count})! Generando siguiente tema...`;
    } else {
      this.alertMessage.set('Lote completo descartado.');
      notice = 'Lote descartado. Generando siguiente tema...';
    }

    this.buttonFeedbackNotice.set(notice);

    setTimeout(() => {
      this.buttonFeedbackNotice.set(null);
      this.generateNewBatch();
    }, 1000);
  }
}

