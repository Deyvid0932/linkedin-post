import { Injectable, signal } from '@angular/core';
import { AccentColor } from '../models/tenant.model';

export type ThemeMode = 'dark' | 'light';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  theme = signal<ThemeMode>((localStorage.getItem('theme') as ThemeMode) || 'dark');
  readonly accentColor = signal<AccentColor>(this.getStoredAccent());

  private readonly accents: Record<AccentColor, readonly string[]> = {
    red: ['#fff1f1', '#ffe0e0', '#ffc7c8', '#ffa0a3', '#f47278', '#d94a52', '#c93640', '#a92732', '#8c2630', '#75262e', '#410f16'],
    blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
    green: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#047857', '#065f46', '#064e3b', '#065f46', '#022c22'],
    yellow: ['#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#d97706', '#a16207', '#854d0e', '#713f12', '#713f12', '#422006'],
  };

  constructor() {
    this.applyAccent(this.accentColor());
    this.applyTheme(this.theme());
  }

  setAccentColor(color: AccentColor): void {
    if (!(color in this.accents)) return;
    this.accentColor.set(color);
    localStorage.setItem('accentColor', color);
    this.applyAccent(color);
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
    this.applyAccent(this.accentColor());
  }

  private applyAccent(color: AccentColor): void {
    const root = document.documentElement;
    const ramp = this.accents[color];
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    shades.forEach((shade, index) => root.style.setProperty(`--color-indigo-${shade}`, ramp[index]));
    root.style.setProperty('--accent', ramp[6]);
    root.style.setProperty('--accent-text', this.theme() === 'dark' ? ramp[4] : ramp[6]);
    root.style.setProperty('--focus', ramp[6]);
  }

  private getStoredAccent(): AccentColor {
    const stored = localStorage.getItem('accentColor');
    return stored === 'blue' || stored === 'green' || stored === 'yellow' || stored === 'red'
      ? stored
      : 'red';
  }
}
