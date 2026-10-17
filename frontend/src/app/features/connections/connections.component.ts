import { Component } from '@angular/core';
import { LinkedinSettingsComponent } from '../settings/linkedin/linkedin-settings.component';
import { GithubSettingsComponent } from '../settings/github/github-settings.component';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [LinkedinSettingsComponent, GithubSettingsComponent],
  templateUrl: './connections.component.html',
})
export class ConnectionsComponent {}
