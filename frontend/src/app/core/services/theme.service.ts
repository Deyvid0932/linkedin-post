import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme = signal<ThemeMode>((localStorage.getItem('theme') as ThemeMode) || 'dark');

  constructor() {
    this.applyTheme(this.theme());
  }

  toggleTheme(): void {
    const newTheme: ThemeMode = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(newTheme);
    localStorage.setItem('theme', newTheme);
    this.applyTheme(newTheme);
  }

  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
    localStorage.setItem('theme', mode);
    this.applyTheme(mode);
  }

  private applyTheme(mode: ThemeMode): void {
    const root = document.documentElement;
    const body = document.body;
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      if (body) {
        body.classList.add('light');
        body.classList.remove('dark');
      }
    }
  }
}
