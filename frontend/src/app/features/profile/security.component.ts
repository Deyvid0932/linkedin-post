import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.currentUserSignal;
  logout(): void {
    this.auth.logout();
  }
}
