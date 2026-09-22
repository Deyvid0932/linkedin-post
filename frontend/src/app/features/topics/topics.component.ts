import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { TopicService } from '../../core/services/topic.service';
import { BackupTopic } from '../../core/models/topic.model';

export function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (/\b(flutter|react native|android|ios|swift|swiftui|kotlin|mobile|dart|apk|xcode)\b/i.test(t)) {
    return 'Móvil & Apps';
  }
  if (/\b(angular|react|vue|svelte|tailwind|css|html|typescript|javascript|next\.js|nuxt|vite|ui|ux|frontend|signals|rxjs)\b/i.test(t)) {
    return 'Frontend Web';
  }
  if (/\b(spring|java|spring boot|node|nodejs|express|python|fastapi|django|golang|go|docker|kubernetes|k8s|aws|microservicios|microservices|rest|api|grpc|kafka|rabbitmq|virtual threads)\b/i.test(t)) {
    return 'Backend & Cloud';
  }
  if (/\b(sql|mysql|postgres|postgresql|mongodb|redis|database|queries|query|jpa|hibernate|orm|índice|indices|dax|power bi|nosql)\b/i.test(t)) {
    return 'Base de Datos';
  }
  if (/\b(jwt|oauth|oauth2|seguridad|security|ciberseguridad|owasp|auth|encriptación|encryption|zero trust|vulnerabilidad|tokens|penetration|pentesting)\b/i.test(t)) {
    return 'Ciberseguridad';
  }
  if (/\b(arquitectura|architecture|clean code|clean architecture|patrones|design patterns|junior|senior|tech lead|carrera|entrevista|entrevistas|git|github|ci\/cd|devops)\b/i.test(t)) {
    return 'Arquitectura & Carrera';
  }
  return 'General Tech';
}

@Component({
  selector: 'app-topics',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  template: `
    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">

      <!-- ENCABEZADO -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Banco de Ideas y Temas (Prioridad 2)
            </h1>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {{ topics().length }} ideas
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona los temas técnicos que el sistema investigará y publicará en LinkedIn cuando no haya commits recientes en GitHub.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          @if (topics().length > 0) {
            <button (click)="showClearAllModal.set(true)" [disabled]="clearingAll()"
                    class="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>{{ clearingAll() ? 'Vaciando...' : 'Vaciar Todo' }}</span>
            </button>
          }

          <button (click)="isInputExpanded.set(!isInputExpanded())"
                  class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
            <span class="text-sm font-bold">{{ isInputExpanded() ? '✕' : '✨' }}</span>
            <span>{{ isInputExpanded() ? 'Ocultar Entrada' : 'Agregar Ideas' }}</span>
          </button>
        </div>
      </div>

      <!-- MODAL DE CONFIRMACIÓN DE VACIAR TODO -->
      @if (showClearAllModal()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div class="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div class="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-900 dark:text-white">¿Vaciar todo el Banco de Ideas?</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Esta acción eliminará las {{ topics().length }} ideas registradas</p>
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
              Se eliminarán todos los temas del banco de ideas. Esta acción no se puede deshacer.
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button (click)="showClearAllModal.set(false)"
                      class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button (click)="confirmClearAll()" [disabled]="clearingAll()"
                      class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer">
                {{ clearingAll() ? 'Vaciando...' : 'Sí, Vaciar Todo' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL DE CONFIRMACIÓN DE ELIMINACIÓN -->
      @if (topicToDelete()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div class="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div class="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-900 dark:text-white">¿Eliminar esta idea?</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
              <p class="text-xs font-semibold text-slate-900 dark:text-white">"{{ topicToDelete()?.title }}"</p>
              <div class="text-[11px] text-slate-500 mt-1">Rubro: {{ topicToDelete()?.category }}</div>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button (click)="topicToDelete.set(null)"
                      class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button (click)="confirmDelete()"
                      class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer">
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- CAJA DE ENTRADA RÁPIDA -->
      @if (isInputExpanded()) {
        <div class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-fadeIn">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="text-base">🚀</span>
              <div>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Importar o Agregar Ideas</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Pega 1 o varias ideas (una por línea). El sistema auto-clasificará el rubro técnico y filtrará duplicados.</p>
              </div>
            </div>
          </div>

          <textarea [(ngModel)]="rawInputText" rows="4"
                    placeholder="Escribe o pega ideas técnicas (una por línea):&#10;• Virtual Threads en Java 26 para alta concurrencia&#10;• Optimización de estado con Signals en Angular 22&#10;• Creación de Apps híbridas con Flutter y Dart&#10;• Estrategias de índices B-Tree en PostgreSQL..."
                    class="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 placeholder-slate-400 leading-relaxed"></textarea>

          @if (feedbackNotice()) {
            <div class="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-between animate-fadeIn">
              <span>{{ feedbackNotice() }}</span>
              <button (click)="feedbackNotice.set(null)" class="text-blue-500 hover:text-blue-700 font-bold ml-2">✕</button>
            </div>
          }

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span class="font-semibold text-slate-700 dark:text-slate-300">Auto-Rubros:</span>
              <span>Frontend Web, Backend & Cloud, Móvil, Base de Datos, Ciberseguridad, Arquitectura...</span>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-auto">
              <button type="button" (click)="isInputExpanded.set(false)"
                      class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button (click)="submitSmartIdeas()" [disabled]="!rawInputText.trim() || saving()"
                      class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer">
                <span>{{ saving() ? 'Guardando...' : '✨ Guardar Ideas al Banco' }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- TARJETA PRINCIPAL: LISTADO Y FILTROS -->
      <div class="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">

        <!-- BARRA DE FILTROS & BÚSQUEDA -->
        <div class="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">

            <!-- TABS DE FILTRO -->
            <div class="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
              <button (click)="filterMode.set('ALL')"
                      [class]="filterMode() === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-extrabold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
                      class="px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                <span>Todos</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px]" [class]="filterMode() === 'ALL' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'">
                  {{ topics().length }}
                </span>
              </button>

              <button (click)="filterMode.set('AVAILABLE')"
                      [class]="filterMode() === 'AVAILABLE' ? 'bg-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
                      class="px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                <span class="w-2 h-2 rounded-full" [class]="filterMode() === 'AVAILABLE' ? 'bg-white' : 'bg-emerald-500'"></span>
                <span>Disponibles</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px]" [class]="filterMode() === 'AVAILABLE' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'">
                  {{ countAvailable() }}
                </span>
              </button>

              <button (click)="filterMode.set('INVESTIGATED')"
                      [class]="filterMode() === 'INVESTIGATED' ? 'bg-blue-600 text-white font-extrabold shadow-sm shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
                      class="px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                <span class="w-2 h-2 rounded-full" [class]="filterMode() === 'INVESTIGATED' ? 'bg-white' : 'bg-blue-500'"></span>
                <span>Investigados</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px]" [class]="filterMode() === 'INVESTIGATED' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'">
                  {{ countInvestigated() }}
                </span>
              </button>
            </div>

            <!-- BÚSQUEDA EN TIEMPO REAL -->
            <div class="relative w-full md:w-72">
              <input [(ngModel)]="searchQuery" placeholder="Buscar por tema o rubro..."
                     class="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors" />
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-slate-400 font-mono pt-1">
            <span>Mostrando {{ filteredTopics().length }} de {{ topics().length }} ideas</span>
            <span>Prioridad de publicación: de arriba hacia abajo</span>
          </div>
        </div>

        <!-- LISTADO DE IDEAS -->
        <div class="space-y-3">
          @for (item of filteredTopics(); track item.id; let i = $index) {
            <div class="p-4 sm:py-4 sm:px-5 rounded-2xl bg-white dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all shadow-sm group">
              <div class="flex flex-col md:grid md:grid-cols-12 md:items-center gap-3">

                <!-- NÚMERO (#1) -->
                <div class="flex items-center gap-2 md:col-span-1">
                  <span class="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 w-8 text-left md:text-center">
                    #{{ i + 1 }}
                  </span>
                </div>

                <!-- TÍTULO Y RUBRO -->
                <div class="overflow-hidden md:col-span-6 space-y-1">
                  <div class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate" [title]="item.title">
                    {{ item.title }}
                  </div>
                  <div class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 font-medium text-slate-700 dark:text-slate-300">
                      {{ item.category || 'General Tech' }}
                    </span>
                    @if (item.isUsed && item.usedAt) {
                      <span>•</span>
                      <span class="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Investigado el {{ item.usedAt | slice:0:10 }} a las {{ item.usedAt | slice:11:16 }}</span>
                    } @else if (item.createdAt) {
                      <span>•</span>
                      <span class="text-[10px] text-slate-400">Agregado el {{ item.createdAt | slice:0:10 }}</span>
                    }
                  </div>
                </div>

                <!-- BADGE INTERACTIVO: DISPONIBLE VS INVESTIGADO Y BOTÓN ENVIAR A ESTUDIO -->
                <div class="md:col-span-3 flex items-center md:justify-center gap-2">
                  @if (item.isUsed) {
                    <button (click)="toggleUsed(item)" [disabled]="togglingTopicId() === item.id" type="button"
                            title="Haz clic para marcar nuevamente como Disponible"
                            class="px-3.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/25 inline-flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer shadow-2xs disabled:opacity-60">
                      @if (togglingTopicId() === item.id) {
                        <span class="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                        <span>Cargando...</span>
                      } @else {
                        <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>Investigado</span>
                      }
                    </button>
                  } @else {
                    <button (click)="toggleUsed(item)" [disabled]="togglingTopicId() === item.id" type="button"
                            title="Haz clic para marcar como Investigado"
                            class="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer shadow-2xs disabled:opacity-60">
                      @if (togglingTopicId() === item.id) {
                        <span class="w-2.5 h-2.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                        <span>Cargando...</span>
                      } @else {
                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Disponible</span>
                      }
                    </button>
                  }

                  <button (click)="openInStudio(item)" [disabled]="openingTopicId() === item.id" type="button"
                          title="Llevar este tema al Estudio para generar publicaciones"
                          class="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-60">
                    @if (openingTopicId() === item.id) {
                      <span class="w-2.5 h-2.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                      <span>Cargando...</span>
                    } @else {
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      <span>Estudio</span>
                    }
                  </button>
                </div>

                <!-- ACCIONES (REORDENAR & ELIMINAR) -->
                <div class="md:col-span-2 flex items-center justify-end gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700/40">
                  <button (click)="movePriority(i, -1)" [disabled]="i === 0"
                          title="Subir prioridad"
                          [class]="i === 0 ? 'opacity-30 cursor-not-allowed text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer'"
                          class="p-1.5 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                  </button>

                  <button (click)="movePriority(i, 1)" [disabled]="i === filteredTopics().length - 1"
                          title="Bajar prioridad"
                          [class]="i === filteredTopics().length - 1 ? 'opacity-30 cursor-not-allowed text-slate-300 dark:text-slate-600' : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer'"
                          class="p-1.5 rounded-lg transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>

                  <button (click)="topicToDelete.set(item)"
                          title="Eliminar idea"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>

              </div>
            </div>
          } @empty {
            <div class="py-16 text-center">
              <div class="max-w-sm mx-auto flex flex-col items-center justify-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                </div>
                <div class="space-y-1">
                  <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200">No se encontraron ideas</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    Escribe o pega tus temas arriba para guardarlos en el banco.
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

      </div>
    </div>
  `
})
export class TopicsComponent implements OnInit {
  private topicService = inject(TopicService);
  private router = inject(Router);

  topics = signal<BackupTopic[]>([]);
  togglingTopicId = signal<string | null>(null);
  openingTopicId = signal<string | null>(null);
  filterMode = signal<'ALL' | 'AVAILABLE' | 'INVESTIGATED'>('ALL');
  searchQuery = '';
  isInputExpanded = signal(true);
  rawInputText = '';
  saving = signal(false);
  feedbackNotice = signal<string | null>(null);

  showClearAllModal = signal(false);
  clearingAll = signal(false);
  topicToDelete = signal<BackupTopic | null>(null);

  countAvailable = computed(() => this.topics().filter(i => !i.isUsed).length);
  countInvestigated = computed(() => this.topics().filter(i => !!i.isUsed).length);

  filteredTopics = computed(() => {
    let list = this.topics();
    const mode = this.filterMode();

    if (mode === 'AVAILABLE') {
      list = list.filter(i => !i.isUsed);
    } else if (mode === 'INVESTIGATED') {
      list = list.filter(i => !!i.isUsed);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadTopics();
  }

  loadTopics(): void {
    this.topicService.getTopics().subscribe({
      next: (list) => this.topics.set(list || []),
      error: () => this.topics.set([])
    });
  }

  submitSmartIdeas(): void {
    if (!this.rawInputText.trim()) return;
    this.saving.set(true);
    this.feedbackNotice.set(null);

    const existingTitles = new Set(this.topics().map(t => t.title.toLowerCase().trim()));

    const lines = this.rawInputText
      .split('\n')
      .map(l => l.trim().replace(/^[-*•\d.]+\s*/, ''))
      .filter(l => l.length > 0);

    const uniqueLines: string[] = [];
    let duplicatesCount = 0;

    for (const line of lines) {
      const normalized = line.toLowerCase();
      if (existingTitles.has(normalized) || uniqueLines.some(ul => ul.toLowerCase() === normalized)) {
        duplicatesCount++;
      } else {
        uniqueLines.push(line);
      }
    }

    if (uniqueLines.length === 0) {
      this.saving.set(false);
      this.feedbackNotice.set(`Todos los temas ingresados (${duplicatesCount}) ya existen en el banco de ideas.`);
      return;
    }

    const backupTopics = uniqueLines.map(line => ({
      title: line,
      category: detectCategory(line),
      isAiResearch: false,
      priority: 0
    }));

    this.topicService.addBulkTopics({ backupTopics, isAiResearchDefault: false }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.rawInputText = '';
        const msg = duplicatesCount > 0
          ? `Se agregaron ${uniqueLines.length} ideas nuevas (${duplicatesCount} omitidas por ser duplicadas).`
          : `Se agregaron ${uniqueLines.length} ideas exitosamente al banco.`;
        this.feedbackNotice.set(msg);
        this.loadTopics();
      },
      error: () => {
        this.saving.set(false);
        this.loadTopics();
      }
    });
  }

  movePriority(index: number, direction: number): void {
    const list = [...this.topics()];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;

    const temp = list[index];
    list[index] = list[target];
    list[target] = temp;

    this.topics.set(list);

    const reorderPayload = list.map((item, idx) => ({
      id: item.id,
      priority: list.length - idx
    }));

    this.topicService.reorderTopics(reorderPayload).subscribe();
  }

  confirmDelete(): void {
    const item = this.topicToDelete();
    if (!item) return;

    this.topicToDelete.set(null);
    this.topicService.deleteTopic(item.id).subscribe({
      next: () => this.topics.update(list => list.filter(t => t.id !== item.id)),
      error: () => this.loadTopics()
    });
  }

  toggleUsed(item: BackupTopic): void {
    if (this.togglingTopicId()) return;
    this.togglingTopicId.set(item.id);
    this.topicService.toggleTopicUsed(item.id).subscribe({
      next: (updated) => {
        this.togglingTopicId.set(null);
        this.topics.update(list => list.map(t => t.id === updated.id ? updated : t));
      },
      error: () => {
        this.togglingTopicId.set(null);
        this.loadTopics();
      }
    });
  }

  openInStudio(item: BackupTopic): void {
    this.openingTopicId.set(item.id);
    this.router.navigate(['/studio'], { queryParams: { topic: item.title } });
  }

  confirmClearAll(): void {
    this.clearingAll.set(true);
    this.topicService.clearAllTopics().subscribe({
      next: () => {
        this.clearingAll.set(false);
        this.showClearAllModal.set(false);
        this.topics.set([]);
      },
      error: () => {
        this.clearingAll.set(false);
        this.showClearAllModal.set(false);
        this.loadTopics();
      }
    });
  }
}
