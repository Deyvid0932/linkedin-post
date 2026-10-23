import { Component, DestroyRef, ElementRef, HostListener, OnInit, computed, signal, viewChild, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../shared/components/header/header.component';
import { TenantService } from '../core/services/tenant.service';
import { ThemeService } from '../core/services/theme.service';
import { AuthService } from '../core/services/auth.service';
import { trapFocusWithin } from '../shared/utils/trap-focus-within';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentPath = signal(this.router.url.split(/[?#]/)[0]);
  readonly sectionTabs = computed(() => {
    const path = this.currentPath();
    if (['/calendar', '/queue', '/publications'].includes(path)) return [
      { label: 'Calendario', route: '/calendar' }, { label: 'Cola', route: '/queue' }, { label: 'Historial', route: '/publications' },
    ];
    if (['/topics', '/library'].includes(path)) return [
      { label: 'Banco de ideas', route: '/topics' }, { label: 'Biblioteca', route: '/library' },
    ];
    return [];
  });
  private readonly tenantService = inject(TenantService);
  private readonly themeService = inject(ThemeService);
  private readonly authService = inject(AuthService);
  mobileMenuOpen = signal(false);
  private readonly moreMenu = viewChild<ElementRef<HTMLButtonElement>>('moreMenu');
  private readonly mobileDrawer = viewChild<ElementRef<HTMLElement>>('mobileDrawer');

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(event => this.currentPath.set(event.urlAfterRedirects.split(/[?#]/)[0]));
  }

  ngOnInit(): void {
    const loadAppearance = () => this.tenantService.getAppearance().subscribe({
        next: (appearance) => this.themeService.setAccentColor(appearance.userAccentColor),
        error: () => undefined,
      });
    this.authService.ensureSession().subscribe({
      next: (authenticated) => {
        if (authenticated) loadAppearance();
      },
    });
  }

  toggleMobileMenu(): void {
    if (this.mobileMenuOpen()) {
      this.closeMobileMenu();
      return;
    }
    this.mobileMenuOpen.set(true);
    setTimeout(() => document.querySelector<HTMLElement>('#primary-navigation a')?.focus());
  }
  closeMobileMenu(): void {
    if (!this.mobileMenuOpen()) return;
    this.mobileMenuOpen.set(false);
    setTimeout(() => this.moreMenu()?.nativeElement.focus());
  }
  trapMobileMenuFocus(event: KeyboardEvent): void {
    if (!this.mobileMenuOpen()) return;
    const drawer = this.mobileDrawer()?.nativeElement;
    if (drawer) trapFocusWithin(event, drawer);
  }
  @HostListener('document:keydown.escape') onEscape(): void {
    if (this.mobileMenuOpen()) this.closeMobileMenu();
  }
  @HostListener('window:resize') onResize(): void {
    if (window.innerWidth >= 1024) this.closeMobileMenu();
  }
}
