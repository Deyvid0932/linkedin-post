import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    @if (variant === 'floating') {
      <button (click)="themeService.toggleTheme()"
              type="button"
              class="p-2.5 sm:px-4 sm:py-2 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
              [attr.title]="themeService.theme() === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'">
        @if (themeService.theme() === 'dark') {
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span class="hidden sm:inline">Modo Claro</span>
        } @else {
          <svg class="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span class="hidden sm:inline">Modo Oscuro</span>
        }
      </button>
    } @else {
      <button (click)="themeService.toggleTheme()"
              type="button"
              class="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              [attr.title]="themeService.theme() === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'">
        @if (themeService.theme() === 'dark') {
          <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        } @else {
          <svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        }
      </button>
    }
  `
})
export class ThemeToggleComponent {
  @Input() variant: 'compact' | 'floating' = 'compact';
  themeService = inject(ThemeService);
}
