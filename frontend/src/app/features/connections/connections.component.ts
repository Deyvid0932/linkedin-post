import { Component } from '@angular/core';
import { LinkedinSettingsComponent } from '../settings/linkedin/linkedin-settings.component';
import { GithubSettingsComponent } from '../settings/github/github-settings.component';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [LinkedinSettingsComponent, GithubSettingsComponent],
  template: `
    <div class="max-w-6xl mx-auto space-y-10">
      <!-- SECCIÓN LINKEDIN (Ancho Completo) -->
      <div>
        <app-linkedin-settings></app-linkedin-settings>
      </div>

      <!-- SECCIÓN GITHUB (Ancho Completo Alineado) -->
      <div class="pt-6 border-t border-slate-200 dark:border-slate-800">
        <app-github-settings></app-github-settings>
      </div>
    </div>
  `
})
export class ConnectionsComponent { }
