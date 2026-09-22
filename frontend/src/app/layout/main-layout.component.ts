import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../shared/components/header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased relative">
      
      <!-- DESKTOP SIDEBAR (lg:flex) & MOBILE OVERLAY DRAWER -->
      <div [class.hidden]="!mobileMenuOpen()"
           class="lg:block fixed lg:sticky top-0 z-50 lg:z-40 h-screen">
        
        <!-- BACKDROP PARA MÓVIL -->
        @if (mobileMenuOpen()) {
          <div (click)="toggleMobileMenu()"
               class="lg:hidden fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm z-40 animate-fadeIn"></div>
        }

        <app-sidebar (closeMobile)="toggleMobileMenu()" class="relative z-50"></app-sidebar>
      </div>

      <!-- CONTENIDO PRINCIPAL Y HEADER -->
      <div class="flex-1 flex flex-col min-w-0">
        <app-header (toggleMobileMenu)="toggleMobileMenu()"></app-header>
        
        <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>
      </div>

    </div>
  `
})
export class MainLayoutComponent {
  mobileMenuOpen = signal(false);

  toggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }
}
