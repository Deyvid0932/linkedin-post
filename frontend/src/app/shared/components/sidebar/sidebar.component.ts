import { Component, DestroyRef, ElementRef, EventEmitter, HostListener, Output, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Output() closeMobile = new EventEmitter<void>();
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly user = this.auth.currentUserSignal;
  readonly profileOpen = signal(false);
  readonly currentPath = signal(this.router.url.split(/[?#]/)[0]);
  readonly links = [
    { label: 'Inicio', route: '/dashboard', icon: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
    { label: 'Crear', route: '/compose', icon: 'm16 3 5 5-12 12H4v-5ZM13 6l5 5' },
    { label: 'Publicaciones', route: '/calendar', icon: 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3' },
    { label: 'Ideas', route: '/topics', icon: 'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 2H9Z' },
    { label: 'Rendimiento', route: '/insights', icon: 'M4 19V5m0 14h16M8 15v-4m4 4V7m4 8V9m4 6V4' },
  ];
  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.currentPath.set(event.urlAfterRedirects.split(/[?#]/)[0]);
        this.profileOpen.set(false);
      });
  }
  initials(): string {
    return (this.user()?.name || 'Usuario').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
  isActive(route: string): boolean {
    const path = this.currentPath();
    if(route === '/calendar') return ['/calendar', '/queue', '/publications'].includes(path);
    if(route === '/topics') return ['/topics', '/library'].includes(path);
    return path === route;
  }
  onNavClick(): void { this.profileOpen.set(false); this.closeMobile.emit(); }
  toggleProfileMenu(): void {
    if(this.profileOpen()) { this.closeProfileMenu(); return; }
    this.profileOpen.set(true);
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('#profile-options a')?.focus());
  }
  closeProfileMenu(): void {
    if(!this.profileOpen()) return;
    this.profileOpen.set(false);
    this.host.nativeElement.querySelector<HTMLElement>('.app-profile-trigger')?.focus();
  }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeProfileMenu(); }
  @HostListener('document:click', ['$event']) closeWhenClickingOutside(event: MouseEvent): void {
    if(this.profileOpen() && !this.host.nativeElement.querySelector('.app-sidebar-footer')?.contains(event.target as Node)) this.profileOpen.set(false);
  }
  logout(): void { this.onNavClick(); this.auth.logout(); }
}
