import {
  Component,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface NavigationLink {
  label: string;
  route: string;
  icon: string;
}

interface NavigationGroup {
  title: string;
  links: NavigationLink[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Output() closeMobile = new EventEmitter<void>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private authService = inject(AuthService);
  readonly user = this.authService.currentUserSignal;
  readonly profileOpen = signal(false);
  readonly icons: Record<string, string> = {
    '/dashboard': 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    '/compose': 'm16 3 5 5-12 12H4v-5ZM13 6l5 5',
    '/queue': 'M4 5h16v4H4ZM4 13h16M4 18h16',
    '/calendar': 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3',
    '/topics': 'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 2H9Z',
    '/library': 'M5 3h11l4 4v14H5ZM15 3v5h5M8 12h9M8 16h9',
    '/publications': 'M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2',
    '/settings/linkedin': 'M4 8v12M4 4v.1M9 20V9h5v2c4-5 6-1 6 2v7M9 14c0-4 6-4 6 0v6',
    '/settings/github': 'M9 19c-5 1-5-3-7-3M9 22v-4c-5-1-5-8-2-10L6 3l6 2 6-2-1 5c3 2 3 9-2 10v4',
    '/settings/schedule': 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3M14 14h2',
    '/settings/voice': 'M3 12h3l2-7 4 14 3-12 2 5h4',
    '/how-it-works': 'M12 17v.1M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  };
  readonly groups: NavigationGroup[] = [
    {
      title: '',
      links: [
        { label: 'Inicio', route: '/dashboard', icon: '' },
        { label: 'Crear', route: '/compose', icon: '' },
      ],
    },
    {
      title: 'Publicar',
      links: [
        { label: 'Calendario', route: '/calendar', icon: '' },
        { label: 'Cola', route: '/queue', icon: '' },
      ],
    },
    {
      title: 'Tu contenido',
      links: [
        { label: 'Banco de ideas', route: '/topics', icon: '' },
        { label: 'Biblioteca', route: '/library', icon: '▧' },
        { label: 'Historial', route: '/publications', icon: '◷' },
      ],
    },
    {
      title: 'Canales',
      links: [
        { label: 'LinkedIn', route: '/settings/linkedin', icon: '' },
        { label: 'GitHub', route: '/settings/github', icon: '' },
      ],
    },
    {
      title: 'Ajustes',
      links: [
        { label: 'Programación', route: '/settings/schedule', icon: '' },
        { label: 'Voz de IA', route: '/settings/voice', icon: '' },
      ],
    },
  ];

  initials(): string {
    return (this.user()?.name || 'Usuario')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  onNavClick(): void {
    this.closeMobile.emit();
  }

  selectProfileAction(event: Event): void {
    this.closeProfileMenu(event);
    this.onNavClick();
  }

  closeProfileMenu(event?: Event): void {
    const menu =
      event?.currentTarget instanceof HTMLDetailsElement
        ? event.currentTarget
        : (this.host.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>(
            '#profile-menu',
          );
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
    this.profileOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeWhenClickingOutside(event: MouseEvent): void {
    const menu = (this.host.nativeElement as HTMLElement).querySelector<HTMLDetailsElement>(
      'footer details',
    );
    if (menu?.open && !menu.contains(event.target as Node)) {
      menu.open = false;
      this.profileOpen.set(false);
    }
  }

  logout(event: Event): void {
    this.closeProfileMenu(event);
    this.onNavClick();
    this.authService.logout();
  }
}
