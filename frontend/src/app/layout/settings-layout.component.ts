import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { TenantService } from '../core/services/tenant.service';
import { ThemeService } from '../core/services/theme.service';
import { trapFocusWithin } from '../shared/utils/trap-focus-within';

@Component({
  selector: 'app-settings-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './settings-layout.component.html',
  styleUrl: './settings-layout.component.css',
})
export class SettingsLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly theme = inject(ThemeService);
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  readonly menuOpen = signal(false);
  readonly isAdmin = computed(() => this.auth.currentUserSignal()?.roles?.includes('ROLE_ADMIN') ?? false);
  readonly groups = [
    { label: 'Cuenta', links: [
      { label: 'Perfil', route: '/settings/profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
      { label: 'Preferencias', route: '/settings/appearance', icon: 'M4 7h16M4 17h16M8 4v6M16 14v6' },
      { label: 'Seguridad', route: '/settings/security', icon: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4' },
    ] },
    { label: 'Espacio de trabajo', links: [
      { label: 'Canales', route: '/settings/channels', icon: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2' },
      { label: 'Publicación', route: '/settings/schedule', icon: 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3' },
      { label: 'Voz de IA', route: '/settings/voice', icon: 'M3 12h3l2-7 4 14 3-12 2 5h4' },
    ] },
  ];
  readonly advanced = [
    { label: 'Proveedores de IA', route: '/settings/ai-connections' },
    { label: 'Repositorios GitHub', route: '/settings/github' },
    { label: 'Webhooks', route: '/settings/webhooks' },
  ];
  readonly advancedOpen = signal(/settings\/(ai-connections|github|webhooks)/.test(this.router.url));

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      if (/settings\/(ai-connections|github|webhooks)/.test(event.urlAfterRedirects)) this.advancedOpen.set(true);
      this.closeMenu();
    });
  }

  ngOnInit(): void {
    this.tenant.getAppearance().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (appearance) => this.theme.setAccentColor(appearance.userAccentColor),
      error: () => undefined,
    });
  }

  openMenu(): void {
    this.menuOpen.set(true);
    queueMicrotask(() => this.navigation()?.nativeElement.querySelector<HTMLElement>('a')?.focus());
  }

  closeMenu(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.trigger()?.nativeElement.focus();
  }

  trapFocus(event: KeyboardEvent): void {
    const navigation = this.navigation()?.nativeElement;
    if (this.menuOpen() && navigation) trapFocusWithin(event, navigation);
  }

  @HostListener('document:keydown.escape') onEscape(): void { this.closeMenu(); }
  @HostListener('window:resize') onResize(): void {
    if (window.innerWidth > 760) this.closeMenu();
  }
}
