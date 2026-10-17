import { Component, Input, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent {
  @Input() variant: 'compact' | 'floating' = 'compact';
  themeService = inject(ThemeService);
}
