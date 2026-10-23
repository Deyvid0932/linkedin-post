import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface HeaderCommand {
  label: string;
  group: string;
  route: string;
  hint: string;
  icon: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly searchDialog = viewChild<ElementRef<HTMLDialogElement>>('searchDialog');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly searchTrigger = viewChild<ElementRef<HTMLButtonElement>>('searchTrigger');
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly activeCommand = signal(0);
  private readonly commands: HeaderCommand[] = [
    { label: 'Inicio', group: 'Crear y publicar', route: '/dashboard', hint: 'Panel general', icon: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
    { label: 'Crear publicación', group: 'Crear y publicar', route: '/compose', hint: 'Redactar y revisar', icon: 'm16 3 5 5-12 12H4v-5ZM13 6l5 5' },
    { label: 'Calendario', group: 'Crear y publicar', route: '/calendar', hint: 'Vista semanal, mensual y lista', icon: 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3' },
    { label: 'Horarios de publicación', group: 'Ajustes', route: '/settings/schedule', hint: 'Horas recurrentes y zona horaria', icon: 'M4 5h16v16H4ZM4 10h16M8 2v6M16 2v6M8 14h3' },
    { label: 'Cola', group: 'Crear y publicar', route: '/queue', hint: 'Publicaciones pendientes', icon: 'M4 5h16v4H4ZM4 13h16M4 18h16' },
    { label: 'Banco de ideas', group: 'Contenido y rendimiento', route: '/topics', hint: 'Ideas y señales recientes', icon: 'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0l-1 2H9Z' },
    { label: 'Biblioteca', group: 'Contenido y rendimiento', route: '/library', hint: 'Borradores guardados', icon: 'M5 3h11l4 4v14H5ZM15 3v5h5M8 12h9M8 16h9' },
    { label: 'Historial', group: 'Contenido y rendimiento', route: '/publications', hint: 'Resultados confirmados', icon: 'M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2' },
    { label: 'Rendimiento', group: 'Contenido y rendimiento', route: '/insights', hint: 'Métricas disponibles', icon: 'M4 19V5m0 14h16M8 15v-4m4 4V7m4 8V9m4 6V4' },
    { label: 'Conectar LinkedIn', group: 'Canales', route: '/settings/linkedin', hint: 'Cuenta y autorización', icon: 'M4 8v12M4 4v.1M9 20V9h5v2c4-5 6-1 6 2v7M9 14c0-4 6-4 6 0v6' },
    { label: 'Repositorios', group: 'Fuentes de contenido', route: '/settings/github', hint: 'Commits para contenido técnico', icon: 'M9 19c-5 1-5-3-7-3M9 22v-4c-5-1-5-8-2-10L6 3l6 2 6-2-1 5c3 2 3 9-2 10v4' },
    { label: 'Apariencia', group: 'Ajustes', route: '/settings/appearance', hint: 'Tema y color de acento', icon: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
    { label: 'Voz de IA', group: 'Ajustes', route: '/settings/voice', hint: 'Preferencias editoriales', icon: 'M3 12h3l2-7 4 14 3-12 2 5h4' },
    { label: 'Proveedores de IA', group: 'Ajustes', route: '/settings/ai-connections', hint: 'Modelos y credenciales', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1' },
    { label: 'Webhooks', group: 'Ajustes', route: '/settings/webhooks', hint: 'Entregas y destinos', icon: 'M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.72' },
    { label: 'Perfil', group: 'Cuenta', route: '/profile', hint: 'Datos de la cuenta', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' },
    { label: 'Seguridad', group: 'Cuenta', route: '/profile/security', hint: 'Contraseña y sesiones', icon: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4' },
  ];
  readonly results = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    const isAdmin = this.auth.currentUserSignal()?.roles?.includes('ROLE_ADMIN') ?? false;
    const available = isAdmin
      ? [...this.commands, { label: 'Administración', group: 'Admin', route: '/admin', hint: 'Cuentas, cuotas y auditoría', icon: 'M3 4h18v4H3zM3 10h8v10H3zM13 10h8v4h-8zM13 16h8v4h-8z' }]
      : this.commands;
    return query
      ? available.filter((command) => `${command.label} ${command.group} ${command.hint}`.toLocaleLowerCase().includes(query))
      : available;
  });

  openSearch(): void {
    const dialog = this.searchDialog()?.nativeElement;
    if (!dialog) return;
    this.searchQuery.set('');
    this.activeCommand.set(0);
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // jsdom and older browsers may expose the method without implementing it.
        dialog.setAttribute('open', '');
      }
    }
    this.searchOpen.set(true);
    queueMicrotask(() => this.searchInput()?.nativeElement.focus());
  }

  closeSearch(): void {
    const dialog = this.searchDialog()?.nativeElement;
    if (dialog?.open) {
      try {
        dialog.close();
      } catch {
        dialog.removeAttribute('open');
      }
    }
    this.searchOpen.set(false);
    this.searchTrigger()?.nativeElement.focus();
  }

  updateSearch(value: string): void {
    this.searchQuery.set(value);
    this.activeCommand.set(0);
  }

  handleSearchKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.activeCommand.update((index) => (index + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.activeCommand.update((index) => (index - 1 + count) % count);
    } else if (event.key === 'Enter' && count > 0) {
      event.preventDefault();
      this.navigate(this.results()[this.activeCommand()]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSearch();
    }
  }

  navigate(command: HeaderCommand | undefined): void {
    if (!command) return;
    this.closeSearch();
    void this.router.navigateByUrl(command.route);
  }

  onDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeSearch();
  }

  onDialogClick(event: MouseEvent): void {
    if (event.target === this.searchDialog()?.nativeElement) this.closeSearch();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) return;
      event.preventDefault();
      if (!this.searchOpen()) this.openSearch();
    }
  }
}
