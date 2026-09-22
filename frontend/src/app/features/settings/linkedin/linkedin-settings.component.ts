import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CredentialService } from '../../../core/services/credential.service';
import { ConnectLinkedInAccountRequest, LinkedInAccount, LinkedInAccountType } from '../../../core/models/credential.model';
import { DatePipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-linkedin-settings',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, DatePipe, NgClass],
  template: `
    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">

      <!-- 1. HEADER DE LA SECCIÓN -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">in</span>
            <span>Cuentas Conectadas de LinkedIn</span>
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona tus perfiles personales y páginas de empresa con permisos de publicación independientes.
          </p>
        </div>

        <button (click)="openConnectModal()"
                class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          <span>Conectar Nueva Cuenta</span>
        </button>
      </div>

      <!-- MENSAJES DE ESTADO -->
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
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>{{ errorMessage() }}</span>
          </div>
          <button (click)="errorMessage.set(null)" class="hover:opacity-75 text-lg font-bold px-2 cursor-pointer">✕</button>
        </div>
      }

      <!-- LISTADO DE CUENTAS CONECTADAS -->
      <div class="space-y-4">
        @if (loading()) {
          <div class="p-12 text-center text-slate-400 glass-card-pro rounded-3xl space-y-3">
            <div class="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div class="text-xs font-semibold">Cargando cuentas vinculadas de LinkedIn...</div>
          </div>
        } @else if (accounts().length === 0) {
          <!-- EMPTY STATE -->
          <div class="p-10 text-center glass-card-pro rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
            <div class="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </div>
            <div class="space-y-1 max-w-sm mx-auto">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Sin cuentas de LinkedIn vinculadas</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Conecta tu perfil personal o página de empresa para activar publicaciones automáticas y en tiempo real.
              </p>
            </div>
            <button (click)="openConnectModal()"
                    class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>Vincular Primera Cuenta</span>
            </button>
          </div>
        } @else {
          <!-- GRID DE TARJETAS DE CUENTAS -->
          <div class="grid grid-cols-1 gap-4">
            @for (acc of accounts(); track acc.id) {
              <div class="connection-card border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xs space-y-5 transition-all">
                
                <!-- CABECERA DE LA CUENTA -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-3.5">
                    
                    <!-- ICONO DE TIPO -->
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                         [class]="acc.accountType === 'PERSON' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50' : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50'">
                      @if (acc.accountType === 'PERSON') {
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                      } @else {
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      }
                    </div>

                    <!-- DETALLES DE NOMBRE Y BADGES -->
                    <div class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-base font-extrabold text-slate-900 dark:text-white">{{ acc.displayName }}</span>
                        
                        <!-- BADGE TIPO -->
                        @if (acc.accountType === 'PERSON') {
                          <span class="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20">
                            Perfil Personal
                          </span>
                        } @else {
                          <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-500/20">
                            Página de Organización
                          </span>
                        }

                        <!-- BADGE PRINCIPAL -->
                        @if (acc.isPrimary) {
                          <span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                            Principal
                          </span>
                        }
                      </div>

                      <div class="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                        <span>URN: {{ acc.authorUrn }}</span>
                        @if (acc.vanityName) {
                          <span class="text-slate-400">• {{ acc.vanityName }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- INTERRUPTOR / TOGGLE ENABLED -->
                  <div class="flex items-center gap-3 self-end sm:self-auto">
                    <div class="text-right">
                      <div class="text-xs font-bold" [class]="acc.isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'">
                        {{ acc.isEnabled ? 'Publicación Activa' : 'Publicación Pausada' }}
                      </div>
                      <div class="text-[10px] text-slate-400">
                        {{ acc.isEnabled ? 'Disponible para pipeline' : 'Excluida de subidas' }}
                      </div>
                    </div>

                    <button type="button"
                            (click)="toggleAccount(acc)"
                            [disabled]="actionLoading() === acc.id"
                            class="w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer shadow-inner"
                            [class]="acc.isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'">
                      <div class="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform"
                           [class]="acc.isEnabled ? 'translate-x-6' : 'translate-x-0'"></div>
                    </button>
                  </div>
                </div>

                <!-- BARRA DE VIGENCIA DEL TOKEN -->
                <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-600 dark:text-slate-400 font-semibold">Vigencia del Token de Acceso:</span>

                    <span class="font-bold font-mono text-xs"
                          [ngClass]="{
                            'text-emerald-600 dark:text-emerald-400': acc.daysRemaining > 30,
                            'text-amber-600 dark:text-amber-400': acc.daysRemaining <= 30 && acc.daysRemaining >= 15,
                            'text-rose-600 dark:text-rose-400': acc.daysRemaining < 15
                          }">
                      {{ acc.daysRemaining }} días restantes ({{ calcPercentage(acc.daysRemaining) }}%)
                      @if (acc.tokenExpiresAt) {
                        <span class="text-slate-400 font-normal"> (Expira: {{ acc.tokenExpiresAt | date:'dd/MM/yyyy' }})</span>
                      }
                    </span>
                  </div>

                  <div class="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500"
                         [style.width.%]="calcPercentage(acc.daysRemaining)"
                         [ngClass]="{
                           'bg-emerald-500': acc.daysRemaining > 30,
                           'bg-amber-500': acc.daysRemaining <= 30 && acc.daysRemaining >= 15,
                           'bg-rose-500': acc.daysRemaining < 15
                         }">
                    </div>
                  </div>
                </div>

                <!-- ACCIONES INFERIORES DE LA CUENTA Y GESTIÓN DE LÍMITE -->
                <div class="flex flex-col md:flex-row md:items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs gap-3">
                  <!-- CONTROL RÁPIDO DE LÍMITE DIARIO -->
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">Límite Diario:</span>
                    <div class="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                      <button (click)="adjustLimit(acc, -1)" [disabled]="(acc.maxPostsPerDay || 1) <= 1 || actionLoading() === acc.id"
                              class="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer shadow-xs">
                        -
                      </button>
                      <span class="px-3 font-bold font-mono text-indigo-600 dark:text-indigo-400 text-xs">
                        {{ acc.maxPostsPerDay || 1 }} post/día
                      </span>
                      <button (click)="adjustLimit(acc, 1)" [disabled]="(acc.maxPostsPerDay || 1) >= 10 || actionLoading() === acc.id"
                              class="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer shadow-xs">
                        +
                      </button>
                    </div>

                    <!-- BOTÓN REINICIAR CUPO DE HOY PARA PRUEBAS -->
                    <button (click)="resetTodayQuota(acc)" [disabled]="actionLoading() === acc.id"
                            title="Reinicia el conteo de publicaciones realizadas hoy para pruebas inmediatas"
                            class="px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] border border-indigo-500/20 transition-all flex items-center gap-1 cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                      <span>Restablecer cupo hoy</span>
                    </button>

                    @if (!acc.isPrimary) {
                      <button (click)="setAsPrimary(acc)" [disabled]="actionLoading() === acc.id"
                              class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition-colors cursor-pointer">
                        Principal
                      </button>
                    }
                  </div>

                  <div class="flex items-center gap-2 self-end md:self-auto">
                    <button (click)="requestEditAccount(acc)"
                            class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      <span>Renovar Token</span>
                    </button>

                    <div class="h-4 w-px bg-slate-200 dark:border-slate-700 hidden sm:block mx-1"></div>

                    <button (click)="disconnectAccount(acc)" [disabled]="actionLoading() === acc.id"
                            title="Desconectar cuenta"
                            class="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold transition-colors cursor-pointer flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                      <span>Desconectar</span>
                    </button>
                  </div>
                </div>

              </div>
            }
          </div>
        }
      </div>

      <!-- MODAL CONECTAR / EDITAR CUENTA -->
      @if (showConnectModal()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-fadeIn">
            
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2.5">
                <span class="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">in</span>
                <h3 class="font-extrabold text-base text-slate-900 dark:text-white">
                  {{ editingAccountId() ? 'Renovar Token de Cuenta' : 'Vincular Cuenta de LinkedIn' }}
                </h3>
              </div>
              <button (click)="closeConnectModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <!-- SELECTOR DE TIPO (PERSON VS ORGANIZATION) -->
            @if (!editingAccountId()) {
              <div class="grid grid-cols-2 gap-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
                <button type="button"
                        (click)="selectedType.set('PERSON')"
                        [class]="selectedType() === 'PERSON' ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold'"
                        class="py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  <span>Perfil Personal</span>
                </button>

                <button type="button"
                        (click)="selectedType.set('ORGANIZATION')"
                        [class]="selectedType() === 'ORGANIZATION' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold'"
                        class="py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  <span>Página de Empresa</span>
                </button>
              </div>
            }

            <form [formGroup]="accountForm" (ngSubmit)="submitAccount()" class="space-y-4 text-xs">
              
              <!-- OPCIÓN DE REUTILIZAR TOKEN EXISTENTE PARA ORGANIZACIÓN -->
              @if (selectedType() === 'ORGANIZATION' && !editingAccountId() && personAccounts().length > 0) {
                <div class="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2">
                  <label class="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox"
                           [checked]="useExistingToken()"
                           (change)="useExistingToken.set(!useExistingToken())"
                           class="w-4 h-4 text-indigo-600 rounded" />
                    <span>Reutilizar Access Token de mi Perfil Personal</span>
                  </label>

                  @if (useExistingToken()) {
                    <div class="pl-6 pt-1 text-[11px] text-slate-500">
                      Se usarán las credenciales de: <strong class="text-indigo-600 dark:text-indigo-400">{{ personAccounts()[0].displayName }}</strong> (debe tener permisos de Administrador en la página).
                    </div>
                  }
                </div>
              }

              <!-- ACCESS TOKEN -->
              @if (!useExistingToken()) {
                <div>
                  <label class="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    LinkedIn Access Token
                  </label>
                  <div class="relative">
                    <input formControlName="accessToken"
                           [type]="showToken() ? 'text' : 'password'"
                           placeholder="AQV... (Pega el token OAuth2)"
                           class="w-full pl-4 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-all" />
                    <button type="button"
                            (click)="showToken.set(!showToken())"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                      {{ showToken() ? 'Ocultar' : 'Ver' }}
                    </button>
                  </div>
                </div>
              }

              <!-- CAMPOS ESPECÍFICOS DE ORGANIZACIÓN -->
              @if (selectedType() === 'ORGANIZATION') {
                <div>
                  <label class="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nombre de la Empresa (Display Name)
                  </label>
                  <input formControlName="displayName"
                         placeholder="Ej: Mi Empresa Tech SAC"
                         class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-all" />
                </div>

                <div>
                  <label class="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Organization ID o URN
                  </label>
                  <input formControlName="authorUrn"
                         placeholder="Ej: 10392812 o urn:li:organization:10392812"
                         class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-all" />
                  <span class="text-[10px] text-slate-400 mt-1 block">Puedes obtener el ID numérico de tu empresa desde la URL de administración en LinkedIn.</span>
                </div>
              }

              <!-- LÍMITE DIARIO DE PUBLICACIONES -->
              <div>
                <label class="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Límite Máximo de Publicaciones por Día
                </label>
                <div class="flex items-center gap-3">
                  <input formControlName="maxPostsPerDay" type="number" min="1" max="10"
                         class="w-32 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500 transition-all text-xs" />
                  <span class="text-slate-500 text-[11px]">publicación(es) como máximo cada día para esta cuenta</span>
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" (click)="closeConnectModal()"
                        class="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="submit"
                        [disabled]="accountForm.invalid && !useExistingToken()"
                        class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer">
                  @if (saving()) {
                    <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Guardando...</span>
                  } @else {
                    <span>Guardar y Conectar</span>
                  }
                </button>
              </div>

            </form>

          </div>
        </div>
      }

      <!-- MODAL ADVERTENCIA AL EDITAR TOKEN -->
      @if (showEditWarningModal()) {
        <div class="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fadeIn">
            <div class="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div class="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h3 class="font-bold text-base text-slate-900 dark:text-white">¿Modificar Token Activo?</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Advertencia de Continuidad</p>
              </div>
            </div>

            <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Reemplazar el token activo de esta cuenta interrumpirá las publicaciones si el nuevo token carece de los permisos necesarios (<code>w_member_social</code> o <code>w_organization_social</code>).
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button (click)="showEditWarningModal.set(false)"
                      class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                Cancelar
              </button>
              <button (click)="confirmUnlockToken()"
                      class="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer">
                Entendido, Continuar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class LinkedinSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private credentialService = inject(CredentialService);

  accounts = signal<LinkedInAccount[]>([]);
  loading = signal(false);
  saving = signal(false);
  actionLoading = signal<string | null>(null);

  showConnectModal = signal(false);
  showEditWarningModal = signal(false);
  selectedType = signal<LinkedInAccountType>('PERSON');
  useExistingToken = signal(false);
  showToken = signal(false);

  editingAccountId = signal<string | null>(null);
  accountToEdit = signal<LinkedInAccount | null>(null);

  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  personAccounts = computed(() => this.accounts().filter(a => a.accountType === 'PERSON'));

  accountForm = this.fb.group({
    accessToken: ['', [Validators.minLength(20)]],
    displayName: [''],
    authorUrn: [''],
    maxPostsPerDay: [1, [Validators.min(1), Validators.max(10)]]
  });

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.credentialService.getLinkedInAccounts().subscribe({
      next: (accs) => {
        this.accounts.set(accs || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Error cargando cuentas de LinkedIn:', err);
        this.loading.set(false);
      }
    });
  }

  calcPercentage(days: number): number {
    return Math.min(100, Math.max(0, (days / 60) * 100));
  }

  openConnectModal(): void {
    this.editingAccountId.set(null);
    this.accountToEdit.set(null);
    this.selectedType.set('PERSON');
    this.useExistingToken.set(false);
    this.accountForm.reset();
    this.showConnectModal.set(true);
  }

  closeConnectModal(): void {
    this.showConnectModal.set(false);
    this.editingAccountId.set(null);
    this.accountToEdit.set(null);
  }

  requestEditAccount(acc: LinkedInAccount): void {
    this.accountToEdit.set(acc);
    this.showEditWarningModal.set(true);
  }

  confirmUnlockToken(): void {
    const acc = this.accountToEdit();
    this.showEditWarningModal.set(false);
    if (!acc) return;

    this.editingAccountId.set(acc.id);
    this.selectedType.set(acc.accountType);
    this.accountForm.patchValue({
      displayName: acc.displayName,
      authorUrn: acc.authorUrn,
      accessToken: ''
    });
    this.showConnectModal.set(true);
  }

  toggleAccount(acc: LinkedInAccount): void {
    this.actionLoading.set(acc.id);
    this.credentialService.toggleLinkedInAccount(acc.id).subscribe({
      next: (updated) => {
        this.accounts.update(list => list.map(item => item.id === updated.id ? updated : item));
        this.actionLoading.set(null);
        this.successMessage.set(`Cuenta '${acc.displayName}' ${updated.isEnabled ? 'activada' : 'pausada'} para publicaciones.`);
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al cambiar estado de la cuenta.');
      }
    });
  }

  setAsPrimary(acc: LinkedInAccount): void {
    this.actionLoading.set(acc.id);
    this.credentialService.setPrimaryLinkedInAccount(acc.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.successMessage.set(`'${acc.displayName}' establecida como cuenta principal de publicación.`);
        this.loadAccounts();
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al establecer cuenta principal.');
      }
    });
  }

  disconnectAccount(acc: LinkedInAccount): void {
    if (!confirm(`¿Estás seguro de que deseas revocar y desconectar la cuenta '${acc.displayName}'?`)) return;

    this.actionLoading.set(acc.id);
    this.credentialService.deleteLinkedInAccount(acc.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.successMessage.set(`Cuenta '${acc.displayName}' desconectada exitosamente.`);
        this.loadAccounts();
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error desconectando la cuenta.');
      }
    });
  }

  submitAccount(): void {
    const val = this.accountForm.value;
    const isOrg = this.selectedType() === 'ORGANIZATION';

    let authorUrn = val.authorUrn?.trim();
    if (isOrg && authorUrn && !authorUrn.startsWith('urn:li:organization:')) {
      authorUrn = 'urn:li:organization:' + authorUrn;
    }

    const payload: ConnectLinkedInAccountRequest = {
      accountType: this.selectedType(),
      expiresInDays: 60,
      maxPostsPerDay: val.maxPostsPerDay || 1
    };

    if (this.useExistingToken() && this.personAccounts().length > 0) {
      payload.useExistingTokenFromAccountId = this.personAccounts()[0].id;
    } else {
      payload.accessToken = val.accessToken?.trim() || undefined;
    }

    if (isOrg) {
      payload.displayName = val.displayName?.trim() || 'Página de Organización';
      payload.authorUrn = authorUrn;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.credentialService.connectLinkedInAccount(payload).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.closeConnectModal();
        this.successMessage.set(`Cuenta '${created.displayName}' vinculada y cifrada exitosamente.`);
        this.loadAccounts();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(err?.error?.message || 'Error al conectar la cuenta de LinkedIn.');
      }
    });
  }

  adjustLimit(acc: LinkedInAccount, delta: number): void {
    const current = acc.maxPostsPerDay || 1;
    const nextVal = Math.min(10, Math.max(1, current + delta));
    if (nextVal === current) return;

    this.actionLoading.set(acc.id);
    this.credentialService.updateAccountLimit(acc.id, nextVal).subscribe({
      next: (updated) => {
        this.accounts.update(list => list.map(item => item.id === updated.id ? updated : item));
        this.actionLoading.set(null);
        this.successMessage.set(`Límite diario de '${acc.displayName}' actualizado a ${updated.maxPostsPerDay} post(s)/día.`);
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al actualizar límite diario.');
      }
    });
  }

  resetTodayQuota(acc: LinkedInAccount): void {
    if (!confirm(`¿Deseas restablecer el cupo de hoy para la cuenta '${acc.displayName}'? Podrás probar publicaciones de inmediato.`)) return;

    this.actionLoading.set(acc.id);
    this.credentialService.resetTodayQuota(acc.id).subscribe({
      next: (res) => {
        this.actionLoading.set(null);
        this.successMessage.set(res.message || 'Cupo diario restablecido con éxito.');
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.errorMessage.set(err?.error?.message || 'Error al restablecer cupo.');
      }
    });
  }
}

