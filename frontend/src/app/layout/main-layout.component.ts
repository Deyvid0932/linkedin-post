import { Component, ElementRef, HostListener, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../shared/components/header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  mobileMenuOpen = signal(false);
  private readonly moreMenu = viewChild<ElementRef<HTMLButtonElement>>('moreMenu');

  toggleMobileMenu(): void {
    if (this.mobileMenuOpen()) {
      this.closeMobileMenu();
      return;
    }
    this.mobileMenuOpen.set(true);
    setTimeout(() => document.querySelector<HTMLElement>('#primary-navigation a')?.focus());
  }
  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    setTimeout(() => this.moreMenu()?.nativeElement.focus());
  }
  @HostListener('document:keydown.escape') onEscape(): void {
    if (this.mobileMenuOpen()) this.closeMobileMenu();
  }
}
