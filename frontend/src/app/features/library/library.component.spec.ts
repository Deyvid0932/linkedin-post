import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { LibraryComponent } from './library.component';

describe('LibraryComponent', () => {
  const draft = {
    id: 'draft-1',
    title: 'Idea',
    text: 'Un texto revisado',
    tone: 'TECHNICAL',
    audience: 'Devs',
    goal: 'TEACH',
    queued: false,
    updatedAt: '2026-10-10',
  };
  let component: LibraryComponent;
  let service: {
    list: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    unqueue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(() => of([draft])),
      approve: vi.fn(() => of({ ...draft, queued: true })),
      unqueue: vi.fn(() => of(draft)),
    };
    TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [provideRouter([]), { provide: ContentDraftService, useValue: service }],
    });
    component = TestBed.createComponent(LibraryComponent).componentInstance;
    component.drafts.set([draft]);
  });

  it('approves from the row actions and updates the visible status', () => {
    component.toggleApproval(draft);
    expect(service.approve).toHaveBeenCalledWith('draft-1');
    expect(component.drafts()[0].queued).toBe(true);
    expect(component.message()).toContain('añadida a la cola');
  });

  it('keeps the draft and shows a recoverable error when approval fails', () => {
    service.approve.mockReturnValue(
      throwError(() => ({ error: { message: 'Elige una cuenta de LinkedIn' } })),
    );
    component.toggleApproval(draft);
    expect(component.drafts()[0].queued).toBe(false);
    expect(component.error()).toBe('Elige una cuenta de LinkedIn');
  });
});
