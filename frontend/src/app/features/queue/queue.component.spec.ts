import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { PublicationService } from '../../core/services/publication.service';
import { QueueComponent } from './queue.component';

describe('QueueComponent', () => {
  it('removes an approved post from the queue while keeping it as a draft', () => {
    const post = {
      id: 'draft-1',
      sourceMode: 'BACKUP' as const,
      status: 'PENDING' as const,
      generatedText: 'Texto que debe conservarse',
      createdAt: '2026-10-17T08:00:00',
    };
    const getQueue = vi.fn(() => of([post]));
    const unqueue = vi.fn(() => of({ ...post, queued: false }));
    const publishQueuedNow = vi.fn(() => of({ success: true, message: 'Publicado' }));

    TestBed.configureTestingModule({
      imports: [QueueComponent],
      providers: [
        provideRouter([]),
        {
          provide: PublicationService,
          useValue: { getQueue, publishQueuedNow },
        },
        {
          provide: ContentDraftService,
          useValue: { unqueue },
        },
      ],
    });

    const fixture = TestBed.createComponent(QueueComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.pendingAction.set({ kind: 'remove', post });
    component.confirmAction();

    expect(unqueue).toHaveBeenCalledWith('draft-1');
    expect(publishQueuedNow).not.toHaveBeenCalled();
    expect(component.message()).toBe('Publicación retirada de la cola.');
    expect(component.error()).toBe('');
  });

  it('does not publish until the user confirms the immediate action', () => {
    const post = {
      id: 'draft-2',
      sourceMode: 'BACKUP' as const,
      status: 'PENDING' as const,
      generatedText: 'Publicación manual',
      createdAt: '2026-10-17T08:00:00',
    };
    const publishQueuedNow = vi.fn(() => of({ success: true, message: 'Enviado a LinkedIn' }));

    TestBed.configureTestingModule({
      imports: [QueueComponent],
      providers: [
        provideRouter([]),
        { provide: PublicationService, useValue: { getQueue: () => of([post]), publishQueuedNow } },
        { provide: ContentDraftService, useValue: { unqueue: vi.fn(() => of(post)) } },
      ],
    });

    const component = TestBed.createComponent(QueueComponent).componentInstance;
    component.pendingAction.set({ kind: 'publish', post });

    expect(publishQueuedNow).not.toHaveBeenCalled();
    component.confirmAction();
    expect(publishQueuedNow).toHaveBeenCalledWith('draft-2');
    expect(component.message()).toBe('Enviado a LinkedIn');
  });
});
