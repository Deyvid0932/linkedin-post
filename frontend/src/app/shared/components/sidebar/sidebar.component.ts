import { Component, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="w-68 h-screen border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/95 backdrop-blur-xl flex flex-col justify-between p-4 transition-colors flex-shrink-0">
      <div class="space-y-6">

        <div class="flex items-center justify-between px-2 py-1">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/25">
              in
            </div>
            <div>
              <div class="font-extrabold text-slate-900 dark:text-white text-base tracking-tight whitespace-nowrap">AutoPost SaaS</div>
              <div class="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider whitespace-nowrap">LinkedIn Zero-Touch</div>
            </div>
          </div>

          <button (click)="onNavClick()" class="lg:hidden p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <nav class="space-y-1">
          <a routerLink="/dashboard"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 00-1 1m-6 0h6"/></svg>
            <span class="truncate">Panel General</span>
          </a>

          <a routerLink="/studio"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span class="truncate">Estudio de Contenido</span>
          </a>

          <a routerLink="/publications"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
            <span class="truncate">Historial de Posts</span>
          </a>

          <a routerLink="/topics"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            <span class="truncate">Banco de Ideas</span>
          </a>

          <a routerLink="/connections"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            <span class="truncate">Conexiones</span>
          </a>

          <a routerLink="/settings"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span class="truncate">Automatización & IA</span>
          </a>

          <a routerLink="/how-it-works"
             (click)="onNavClick()"
             routerLinkActive="bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-500 shadow-xs"
             [routerLinkActiveOptions]="{exact: true}"
             class="group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all text-xs font-semibold whitespace-nowrap border-l-4 border-transparent">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            <span class="truncate">Cómo Funciona</span>
          </a>
        </nav>
      </div>

      <!-- FOOTER DE SIDEBAR CON SEPARADOR Y VERSIÓN -->
      <div class="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
        <div class="px-2 flex items-center justify-between text-[11px] text-slate-400">
          <span class="font-semibold text-slate-500 dark:text-slate-400">AutoPost SaaS</span>
          <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">v2.4</span>
        </div>

        <button (click)="logout()"
                class="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all text-xs font-bold border border-rose-200/80 dark:border-rose-500/20 whitespace-nowrap cursor-pointer">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  @Output() closeMobile = new EventEmitter<void>();
  private authService = inject(AuthService);

  onNavClick(): void {
    this.closeMobile.emit();
  }

  logout(): void {
    this.onNavClick();
    this.authService.logout();
  }
}
