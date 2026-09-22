import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { PublicationService } from '../../../core/services/publication.service';
import { PublicationLog } from '../../../core/models/publication.model';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-publications',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Historial de Publicaciones</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Auditoría completa de posts generados, estado en LinkedIn y métricas de ejecución</p>
        </div>

        @if (publishedLogs().length > 0) {
          <button (click)="clearAllHistory()" [disabled]="clearing()"
                  class="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>{{ clearing() ? 'Limpiando...' : 'Limpiar Historial' }}</span>
          </button>
        }
      </div>

      <!-- ALERTAS DE FEEDBACK -->
      @if (successMessage()) {
        <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between animate-fadeIn shadow-sm">
          <div class="flex items-center gap-2 font-semibold">
            <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            <span>{{ successMessage() }}</span>
          </div>
          <button (click)="successMessage.set(null)" class="text-emerald-600 hover:text-emerald-800 dark:hover:text-white text-base leading-none cursor-pointer">✕</button>
        </div>
      }

      @if (errorMessage()) {
        <div class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between animate-fadeIn shadow-sm">
          <div class="flex items-center gap-2 font-semibold">
            <svg class="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>{{ errorMessage() }}</span>
          </div>
          <button (click)="errorMessage.set(null)" class="text-rose-600 hover:text-rose-800 dark:hover:text-white text-base leading-none cursor-pointer">✕</button>
        </div>
      }

      <!-- BARRA DE FILTROS -->
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">

          <!-- BÚSQUEDA -->
          <div class="relative flex-1">
            <input [(ngModel)]="searchQuery" placeholder="Buscar por texto de post, tema o error..."
                   class="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 transition-all" />
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <!-- PESTAÑAS DE ESTADO -->
          <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start md:self-auto overflow-x-auto max-w-full">
            <button (click)="statusFilter.set('ALL')"
                    [class]="statusFilter() === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'"
                    class="px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer">
              Todos ({{ allItems().length }})
            </button>
            <button (click)="statusFilter.set('PENDING')"
                    [class]="statusFilter() === 'PENDING' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium'"
                    class="px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
              <span class="w-1.5 h-1.5 rounded-full" [class]="statusFilter() === 'PENDING' ? 'bg-white' : 'bg-indigo-500'"></span>
              <span>En Cola ({{ queuedCount() }})</span>
            </button>
            <button (click)="statusFilter.set('SUCCESS')"
                    [class]="statusFilter() === 'SUCCESS' ? 'bg-emerald-500 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium'"
                    class="px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
              <span class="w-1.5 h-1.5 rounded-full" [class]="statusFilter() === 'SUCCESS' ? 'bg-white' : 'bg-emerald-500'"></span>
              <span>Publicados ({{ successCount() }})</span>
            </button>
            <button (click)="statusFilter.set('FAILED')"
                    [class]="statusFilter() === 'FAILED' ? 'bg-rose-500 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium'"
                    class="px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
              <span class="w-1.5 h-1.5 rounded-full" [class]="statusFilter() === 'FAILED' ? 'bg-white' : 'bg-rose-500'"></span>
              <span>Fallidos ({{ failedCount() }})</span>
            </button>
          </div>
        </div>

        <!-- PESTAÑAS DE ORIGEN / PRIORIDAD -->
        <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">Origen:</span>
          <button (click)="modeFilter.set('ALL')"
                  [class]="modeFilter() === 'ALL' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
                  class="px-2.5 py-1 rounded-md text-[11px] transition-all whitespace-nowrap cursor-pointer">
            Todas las Prioridades
          </button>
          <button (click)="modeFilter.set('PROJECT')"
                  [class]="modeFilter() === 'PROJECT' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
                  class="px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500" [class.bg-white]="modeFilter() === 'PROJECT'"></span>
            <span>Prioridad 1: Proyectos (GitHub)</span>
          </button>
          <button (click)="modeFilter.set('IDEAS')"
                  [class]="modeFilter() === 'IDEAS' ? 'bg-purple-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
                  class="px-2.5 py-1 rounded-md text-[11px] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500" [class.bg-white]="modeFilter() === 'IDEAS'"></span>
            <span>Prioridad 2: Banco de Ideas</span>
          </button>
        </div>
      </div>

      <!-- CONTENEDOR DE REGISTROS -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

        <!-- VISTA TABLA (DESKTOP) -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-3.5 w-40 whitespace-nowrap">Prioridad / Origen</th>
                <th class="px-4 py-3.5 w-32 whitespace-nowrap">Estado</th>
                <th class="px-4 py-3.5">Texto del Post</th>
                <th class="px-4 py-3.5 w-16 text-center whitespace-nowrap">Imagen</th>
                <th class="px-4 py-3.5 w-36 whitespace-nowrap">Fecha</th>
                <th class="px-4 py-3.5 text-right w-48 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              @for (log of paginatedLogs(); track log.id) {
                <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors border-l-4"
                    [class.border-l-indigo-500]="log.status === 'PENDING'"
                    [class.border-l-emerald-500]="log.status === 'SUCCESS'"
                    [class.border-l-rose-500]="log.status === 'FAILED'">
                  <!-- ORIGEN -->
                  <td class="px-4 py-3 whitespace-nowrap font-semibold">
                    @if (log.status === 'PENDING') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        <span>P0: En Cola</span>
                      </span>
                    } @else if (log.sourceMode === 'PROJECT') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span>P1: GitHub</span>
                      </span>
                    } @else if (log.sourceMode === 'RESEARCH') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        <span>P2: Ideas IA</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>P2: Tema</span>
                      </span>
                    }
                  </td>

                  <!-- ESTADO -->
                  <td class="px-4 py-3 whitespace-nowrap">
                    @if (log.status === 'PENDING') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span>En Cola</span>
                      </span>
                    } @else if (log.status === 'SUCCESS') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Publicado</span>
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Fallido</span>
                      </span>
                    }
                  </td>

                  <!-- TEXTO DEL POST -->
                  <td class="px-4 py-3 max-w-xs md:max-w-sm truncate text-xs font-medium cursor-help"
                      [title]="log.generatedText || log.errorMessage || 'Sin texto'">
                    {{ log.generatedText || log.errorMessage || 'Sin texto' }}
                  </td>

                  <!-- IMAGEN CON CLICK PARA AMPLIAR -->
                  <td class="px-4 py-3 text-center">
                    @if (log.imageUrl) {
                      <button type="button" (click)="openImagePreview(log.imageUrl)" title="Haz clic para ver imagen ampliada"
                              class="inline-block relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
                        <img [src]="log.imageUrl" alt="Preview" class="w-8 h-8 object-cover" />
                        <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
                        </div>
                      </button>
                    } @else {
                      <span class="text-xs text-slate-400">-</span>
                    }
                  </td>

                  <!-- FECHA -->
                  <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {{ log.createdAt | date:'dd/MM/yy HH:mm' }}
                  </td>

                  <!-- ACCIONES CON MENÚ 3 PUNTOS -->
                  <td class="px-4 py-3 text-right whitespace-nowrap relative">
                    <div class="flex items-center justify-end gap-1.5">

                      <!-- BOTÓN RÁPIDO REINTENTAR SI ES FALLIDO -->
                      @if (log.status === 'FAILED') {
                        <button (click)="retryItem(log)" [disabled]="actionLoadingId() === log.id"
                                title="Reintentar publicación en LinkedIn"
                                class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap">
                          @if (actionLoadingId() === log.id) {
                            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          }
                          <span>Reintentar</span>
                        </button>
                      }

                      <!-- BOTÓN RÁPIDO PUBLICAR SI ES COLA -->
                      @if (log.status === 'PENDING') {
                        <button (click)="publishNow(log)" [disabled]="actionLoadingId() === log.id"
                                title="Publicar inmediatamente"
                                class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap">
                          @if (actionLoadingId() === log.id) {
                            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          }
                          <span>Publicar</span>
                        </button>
                      }

                      <!-- MENÚ DE 3 PUNTOS -->
                      <div class="relative inline-block text-left">
                        <button type="button" (click)="toggleMenu(log.id, $event)"
                                class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Más opciones">
                          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>

                        @if (activeMenuId() === log.id) {
                          <div (click)="$event.stopPropagation()"
                               class="absolute right-0 mt-1 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 animate-fadeIn text-xs">
                            
                            @if (log.status === 'FAILED') {
                              <button (click)="retryItem(log); closeMenu()" class="w-full text-left px-3.5 py-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-semibold flex items-center justify-between cursor-pointer">
                                <span>Reintentar publicación</span>
                              </button>
                            }

                            <button (click)="republishItem(log); closeMenu()" class="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center justify-between cursor-pointer">
                              <span>Volver a publicar en LinkedIn</span>
                            </button>

                            <button (click)="selectLog(log); closeMenu()" class="w-full text-left px-3.5 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium flex items-center justify-between cursor-pointer">
                              <span>Ver detalle de auditoría</span>
                            </button>

                            <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                            <button (click)="deleteItem(log); closeMenu()" class="w-full text-left px-3.5 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold flex items-center justify-between cursor-pointer">
                              <span>Eliminar del historial</span>
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center text-slate-400 text-xs font-semibold">
                    No se encontraron publicaciones con los filtros seleccionados.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- VISTA TARJETAS (MÓVIL) -->
        <div class="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
          @for (log of paginatedLogs(); track log.id) {
            <div class="p-4 space-y-3 border-l-4"
                 [class.border-l-indigo-500]="log.status === 'PENDING'"
                 [class.border-l-emerald-500]="log.status === 'SUCCESS'"
                 [class.border-l-rose-500]="log.status === 'FAILED'">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                  @if (log.status === 'PENDING') {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">En Cola</span>
                  } @else if (log.status === 'SUCCESS') {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Publicado</span>
                  } @else {
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">Fallido</span>
                  }
                  <span class="text-[11px] text-slate-400 font-mono">{{ log.createdAt | date:'dd/MM HH:mm' }}</span>
                </div>

                <div class="flex items-center gap-1">
                  @if (log.status === 'FAILED') {
                    <button (click)="retryItem(log)" [disabled]="actionLoadingId() === log.id"
                            class="px-2 py-1 rounded bg-amber-500 text-white font-bold text-[10px] cursor-pointer">
                      Reintentar
                    </button>
                  }
                  @if (log.status === 'PENDING') {
                    <button (click)="publishNow(log)" [disabled]="actionLoadingId() === log.id"
                            class="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer">
                      Publicar
                    </button>
                  }

                  <!-- MENÚ 3 PUNTOS MÓVIL -->
                  <div class="relative">
                    <button (click)="toggleMenu(log.id, $event)" class="p-1 text-slate-400 hover:text-slate-200">
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                      </svg>
                    </button>

                    @if (activeMenuId() === log.id) {
                      <div (click)="$event.stopPropagation()"
                           class="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 text-xs">
                        @if (log.status === 'FAILED') {
                          <button (click)="retryItem(log); closeMenu()" class="w-full text-left px-3 py-2 text-amber-500 font-semibold">Reintentar publicación</button>
                        }
                        <button (click)="republishItem(log); closeMenu()" class="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200">Volver a publicar</button>
                        <button (click)="selectLog(log); closeMenu()" class="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200">Ver detalle</button>
                        <button (click)="deleteItem(log); closeMenu()" class="w-full text-left px-3 py-2 text-rose-500 font-semibold">Eliminar</button>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <div class="flex items-start gap-3">
                @if (log.imageUrl) {
                  <button type="button" (click)="openImagePreview(log.imageUrl)" class="flex-shrink-0 cursor-pointer">
                    <img [src]="log.imageUrl" alt="Preview" class="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800" />
                  </button>
                }
                <p class="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed"
                   [title]="log.generatedText || log.errorMessage || 'Sin texto'">
                  {{ log.generatedText || log.errorMessage || 'Sin texto' }}
                </p>
              </div>
            </div>
          } @empty {
            <div class="p-8 text-center text-slate-400 text-xs">
              No se encontraron publicaciones.
            </div>
          }
        </div>

        <!-- BARRA DE PAGINACIÓN -->
        <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Mostrando <strong>{{ paginatedLogs().length }}</strong> de <strong>{{ filteredLogs().length }}</strong> registros (Total: {{ allItems().length }})
          </div>

          <div class="flex items-center gap-2">
            <button (click)="prevPage()" [disabled]="currentPage() === 1"
                    class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold disabled:opacity-40 cursor-pointer">
              Anterior
            </button>
            <span class="px-2 font-bold font-mono">Página {{ currentPage() }} de {{ totalPages() || 1 }}</span>
            <button (click)="nextPage()" [disabled]="currentPage() >= totalPages()"
                    class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold disabled:opacity-40 cursor-pointer">
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL 1: DETALLE DE AUDITORÍA -->
      @if (selectedLog()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" (click)="selectedLog.set(null)">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-fadeIn" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Detalle de Auditoría de Publicación</h3>
              <button (click)="selectedLog.set(null)" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            <div class="space-y-3.5 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Prioridad / Origen</span>
                <span class="font-bold text-slate-900 dark:text-white text-xs">
                  {{ selectedLog()?.sourceMode === 'PROJECT' ? 'Prioridad 1 (GitHub)' : 'Prioridad 2 (Banco de Ideas)' }}
                </span>
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Estado de Publicación</span>
                <span class="font-bold text-xs" [class]="selectedLog()?.status === 'SUCCESS' ? 'text-emerald-500' : (selectedLog()?.status === 'PENDING' ? 'text-indigo-500' : 'text-rose-500')">
                  {{ selectedLog()?.status === 'SUCCESS' ? 'Publicado' : (selectedLog()?.status === 'PENDING' ? 'En Cola' : 'Fallido') }}
                </span>
              </div>

              @if (selectedLog()?.imageUrl) {
                <div>
                  <span class="block text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Imagen Adjunta</span>
                  <button type="button" (click)="openImagePreview(selectedLog()!.imageUrl!)"
                          title="Haz clic para ver imagen ampliada"
                          class="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-blue-500 transition-all inline-block">
                    <img [src]="selectedLog()?.imageUrl" alt="Imagen adjunta" class="h-28 w-auto object-cover rounded-lg" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-semibold transition-opacity gap-1">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
                      <span>Clic para ampliar</span>
                    </div>
                  </button>
                </div>
              }

              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Texto Completo del Post</span>
                  <span class="font-mono text-[11px] text-slate-400">{{ selectedLog()?.generatedText?.length || 0 }} caracteres</span>
                </div>
                <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 select-text">
                  {{ selectedLog()?.generatedText || 'Sin texto' }}
                </div>
              </div>

              @if (selectedLog()?.errorMessage) {
                <div>
                  <span class="block text-xs text-rose-500 uppercase font-semibold mb-1">Mensaje de Error / Excepción</span>
                  <div class="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                    {{ selectedLog()?.errorMessage }}
                  </div>
                </div>
              }

              <div class="grid grid-cols-2 gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
                <div>Modelo IA: <span class="font-semibold text-slate-800 dark:text-slate-200">{{ selectedLog()?.llmModelUsed || 'deepseek-chat' }}</span></div>
                <div>Tiempo: <span class="font-semibold text-slate-800 dark:text-slate-200">{{ selectedLog()?.executionTimeMs }} ms</span></div>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2">
              <div class="flex items-center gap-2">
                @if (selectedLog()?.linkedinPostUrn && !selectedLog()?.linkedinPostUrn?.includes('dryrun')) {
                  <a [href]="getLinkedInUrl(selectedLog()?.linkedinPostUrn)" target="_blank" rel="noopener noreferrer"
                     class="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold text-xs hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors inline-flex items-center gap-1.5 cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.27 1.64 1.64 0 0 0 0-3.27z"/></svg>
                    <span>Ver en LinkedIn</span>
                  </a>
                }
                @if (selectedLog()?.status === 'FAILED') {
                  <button (click)="retryItem(selectedLog()!); selectedLog.set(null)" [disabled]="actionLoadingId() === selectedLog()?.id"
                          class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer transition-colors">
                    Reintentar
                  </button>
                }
                <button (click)="republishItem(selectedLog()!); selectedLog.set(null)"
                        class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer transition-colors">
                  Volver a publicar
                </button>
                <button (click)="deleteItem(selectedLog()!); selectedLog.set(null)" class="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 font-bold text-xs hover:bg-rose-500/20 cursor-pointer">
                  Eliminar
                </button>
              </div>

              <button (click)="selectedLog.set(null)" class="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL 2: LIGHTBOX PARA VISUALIZAR IMAGEN EN TAMAÑO COMPLETO (Z-INDEX 100) -->
      @if (previewImageModal()) {
        <div class="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-fadeIn" (click)="closeImagePreview()">
          <div class="relative max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors" (click)="$event.stopPropagation()">
            
            <div class="flex items-center justify-between px-2 py-2 border-b border-slate-100 dark:border-slate-800">
              <span class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span>Vista ampliada de imagen</span>
              </span>
              <button (click)="closeImagePreview()"
                      class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors">
                ✕
              </button>
            </div>

            <div class="p-3 flex items-center justify-center bg-slate-50 dark:bg-slate-950/90 rounded-2xl mt-3 overflow-auto flex-1 min-h-0 border border-slate-100 dark:border-slate-800/60">
              <img [src]="previewImageModal()" alt="Imagen en tamaño completo" class="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-md" />
            </div>

            <div class="mt-3 flex justify-end px-2">
              <button (click)="closeImagePreview()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer transition-colors">
                Cerrar vista
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class PublicationsComponent implements OnInit {
  private publicationService = inject(PublicationService);

  queueLogs = signal<PublicationLog[]>([]);
  publishedLogs = signal<PublicationLog[]>([]);
  allItems = computed(() => [...this.queueLogs(), ...this.publishedLogs()]);

  selectedLog = signal<PublicationLog | null>(null);
  previewImageModal = signal<string | null>(null);
  activeMenuId = signal<string | null>(null);

  clearing = signal(false);
  actionLoadingId = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  searchQuery = '';
  statusFilter = signal<string>('ALL');
  modeFilter = signal<string>('ALL');
  currentPage = signal(1);
  pageSize = 8;

  queuedCount = computed(() => this.queueLogs().length);
  successCount = computed(() => this.publishedLogs().filter(l => l.status === 'SUCCESS').length);
  failedCount = computed(() => this.publishedLogs().filter(l => l.status === 'FAILED').length);

  filteredLogs = computed(() => {
    let result = this.allItems();

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(l =>
        (l.generatedText && l.generatedText.toLowerCase().includes(q)) ||
        (l.errorMessage && l.errorMessage.toLowerCase().includes(q))
      );
    }

    const sFilter = this.statusFilter();
    if (sFilter !== 'ALL') {
      result = result.filter(l => l.status === sFilter);
    }

    const mFilter = this.modeFilter();
    if (mFilter === 'PROJECT') {
      result = result.filter(l => l.sourceMode === 'PROJECT');
    } else if (mFilter === 'IDEAS') {
      result = result.filter(l => l.sourceMode === 'RESEARCH' || l.sourceMode === 'BACKUP');
    }

    return result;
  });

  totalPages = computed(() => Math.ceil(this.filteredLogs().length / this.pageSize));

  paginatedLogs = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredLogs().slice(start, start + this.pageSize);
  });

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    forkJoin({
      queue: this.publicationService.getQueue(),
      history: this.publicationService.getHistory()
    }).subscribe({
      next: (res) => {
        this.queueLogs.set(res.queue || []);
        this.publishedLogs.set(res.history?.content || []);
      },
      error: () => {}
    });
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.activeMenuId.set(this.activeMenuId() === id ? null : id);
  }

  closeMenu(): void {
    this.activeMenuId.set(null);
  }

  openImagePreview(url: string): void {
    this.previewImageModal.set(url);
  }

  closeImagePreview(): void {
    this.previewImageModal.set(null);
  }

  selectLog(log: PublicationLog): void {
    this.selectedLog.set(log);
  }

  publishNow(log: PublicationLog): void {
    this.actionLoadingId.set(log.id);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.publicationService.publishQueuedNow(log.id).subscribe({
      next: (res) => {
        this.actionLoadingId.set(null);
        this.successMessage.set(res.message || 'Post publicado exitosamente en LinkedIn.');
        this.loadHistory();
      },
      error: (err) => {
        this.actionLoadingId.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al publicar post en LinkedIn.');
      }
    });
  }

  retryItem(log: PublicationLog): void {
    this.actionLoadingId.set(log.id);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.publicationService.retryPublication(log.id).subscribe({
      next: (res) => {
        this.actionLoadingId.set(null);
        this.successMessage.set(res.message || 'Post reintentado y publicado exitosamente en LinkedIn.');
        this.loadHistory();
      },
      error: (err) => {
        this.actionLoadingId.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al reintentar la publicación.');
      }
    });
  }

  republishItem(log: PublicationLog): void {
    this.actionLoadingId.set(log.id);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.publicationService.republishPost(log.id).subscribe({
      next: (res) => {
        this.actionLoadingId.set(null);
        this.successMessage.set(res.message || 'Post republicado exitosamente en LinkedIn.');
        this.loadHistory();
      },
      error: (err) => {
        this.actionLoadingId.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al republicar el post.');
      }
    });
  }

  deleteItem(log: PublicationLog): void {
    const isQueue = log.status === 'PENDING';
    const msg = isQueue ? '¿Deseas retirar esta publicación de la cola programada?' : '¿Deseas eliminar este registro del historial?';
    if (!confirm(msg)) return;

    if (isQueue) {
      this.queueLogs.update(list => list.filter(item => item.id !== log.id));
    } else {
      this.publishedLogs.update(list => list.filter(item => item.id !== log.id));
    }

    const op$ = isQueue ? this.publicationService.deleteFromQueue(log.id) : this.publicationService.deletePublication(log.id);
    op$.subscribe({
      next: () => {
        this.successMessage.set(isQueue ? 'Publicación retirada de la cola.' : 'Registro eliminado del historial.');
      },
      error: () => {
        this.loadHistory();
      }
    });
  }

  deleteLog(id: string): void {
    const item = this.allItems().find(l => l.id === id);
    if (item) {
      this.deleteItem(item);
    }
  }

  clearAllHistory(): void {
    if (!confirm('¿Estás seguro de que deseas vaciar TODO el historial de publicaciones? Esta acción no se puede deshacer.')) return;
    this.clearing.set(true);
    this.publishedLogs.set([]);
    this.publicationService.clearHistory().subscribe({
      next: () => {
        this.clearing.set(false);
        this.successMessage.set('Historial vaciado correctamente.');
      },
      error: () => {
        this.clearing.set(false);
        this.loadHistory();
      }
    });
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  getLinkedInUrl(urn?: string): string {
    if (!urn) return 'https://www.linkedin.com/feed/';
    return `https://www.linkedin.com/feed/update/${urn}`;
  }
}
