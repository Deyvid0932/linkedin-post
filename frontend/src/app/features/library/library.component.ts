import { Component } from '@angular/core';
import { PublicationsComponent } from '../publications/history/publications.component';
import { TopicsComponent } from '../topics/topics.component';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [PublicationsComponent, TopicsComponent],
  template: `
    <div class="max-w-6xl mx-auto space-y-8">
      <!-- HISTORIAL Y PUBLICACIONES (Full Width Alineado) -->
      <div>
        <app-publications></app-publications>
      </div>

      <!-- BANCO DE TEMAS (Full Width Alineado) -->
      <div class="pt-4 border-t border-slate-200 dark:border-slate-800">
        <app-topics></app-topics>
      </div>
    </div>
  `
})
export class LibraryComponent { }
