import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContentDraft, ContentDraftService } from '../../core/services/content-draft.service';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
@Component({
  selector: 'app-library',
  standalone: true,
  imports: [DatePipe, RouterLink, DialogComponent],
  templateUrl: './library.component.html',
})
export class LibraryComponent implements OnInit {
  private readonly service = inject(ContentDraftService);
  readonly drafts = signal<ContentDraft[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly busyId = signal<string | null>(null);
  readonly search = signal('');
  readonly filter = signal<'ALL' | 'DRAFT' | 'APPROVED'>('ALL');
  readonly selected = signal<ContentDraft | null>(null);
  readonly filters = [
    { value: 'ALL' as const, label: 'Todos' },
    { value: 'DRAFT' as const, label: 'Borradores' },
    { value: 'APPROVED' as const, label: 'Aprobados' },
  ];
  readonly counts = computed(() => ({
    ALL: this.drafts().length,
    DRAFT: this.drafts().filter((d) => !d.queued).length,
    APPROVED: this.drafts().filter((d) => d.queued).length,
  }));
  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase();
    return this.drafts()
      .filter(
        (d) =>
          (this.filter() === 'ALL' || d.queued === (this.filter() === 'APPROVED')) &&
          (!q || (d.title + ' ' + d.text).toLocaleLowerCase().includes(q)),
      )
      .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  });
  ngOnInit(): void {
    this.load();
  }
  openDraft(draft: ContentDraft, event: Event): void {
    this.dismissMenu(event);
    this.selected.set(draft);
  }
  dismissMenu(event: Event): void {
    (event.currentTarget as HTMLElement | null)?.closest('details')?.removeAttribute('open');
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.list().subscribe({
      next: (d) => {
        this.drafts.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No pudimos cargar la biblioteca.');
      },
    });
  }
  toggleApproval(draft: ContentDraft): void {
    if (this.busyId()) return;
    this.busyId.set(draft.id);
    this.error.set('');
    this.message.set('');
    const request = draft.queued ? this.service.unqueue(draft.id) : this.service.approve(draft.id);
    request.subscribe({
      next: (updated) => {
        this.drafts.update((items) => items.map((item) => (item.id === draft.id ? updated : item)));
        this.message.set(
          updated.queued
            ? 'Publicación aprobada y añadida a la cola.'
            : 'Aprobación retirada; la publicación volvió a borrador.',
        );
        this.busyId.set(null);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message ||
            'No pudimos cambiar el estado. El contenido se conserva; revisa la cuenta de LinkedIn e inténtalo de nuevo.',
        );
        this.busyId.set(null);
      },
    });
  }
}
