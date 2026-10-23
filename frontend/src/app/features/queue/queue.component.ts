import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PublicationLog } from '../../core/models/publication.model';
import { PublicationService } from '../../core/services/publication.service';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [RouterLink, DialogComponent],
  templateUrl: './queue.component.html',
})
export class QueueComponent implements OnInit {
  private readonly publications = inject(PublicationService);
  private readonly drafts = inject(ContentDraftService);
  readonly posts = signal<PublicationLog[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly pendingAction = signal<{ kind: 'publish' | 'remove'; post: PublicationLog } | null>(
    null,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.publications
      .getQueue()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (posts) => this.posts.set(posts),
        error: () => this.error.set('No pudimos cargar la cola. Revisa el backend e inténtalo de nuevo.'),
      });
  }

  confirmAction(): void {
    const action = this.pendingAction();
    if (!action || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    const finish = () => {
      this.busy.set(false);
      this.pendingAction.set(null);
      this.load();
    };
    if (action.kind === 'publish') {
      this.publications
        .publishQueuedNow(action.post.id)
        .pipe(finalize(() => this.busy.set(false)))
        .subscribe({
          next: (result) => {
            this.message.set(result.message || 'AutoPost recibió la solicitud de publicación.');
            this.pendingAction.set(null);
            this.load();
          },
          error: (err) => {
            this.error.set(err?.error?.message || 'No se pudo publicar. El post sigue en la cola.');
          },
        });
      return;
    }
    this.drafts
      .unqueue(action.post.id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.message.set('Publicación retirada de la cola.');
          finish();
        },
        error: (err) => {
          this.error.set(err?.error?.message || 'No se pudo retirar el post de la cola.');
        },
      });
  }
}
