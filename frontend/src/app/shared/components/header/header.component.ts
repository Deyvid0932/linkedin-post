import { Component, OnInit, inject } from '@angular/core';
import { AutomationStateService } from '../../../core/services/automation-state.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [ThemeToggleComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  readonly state = inject(AutomationStateService);
  ngOnInit(): void {
    this.state.load();
  }
}
