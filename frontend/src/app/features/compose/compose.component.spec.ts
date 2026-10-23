import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { ComposeComponent } from './compose.component';
import { ContentDraftService } from '../../core/services/content-draft.service';
import { CredentialService } from '../../core/services/credential.service';
import { AuthService } from '../../core/services/auth.service';

describe('Compose workflow', () => {
  const draft = {
    id: 'draft-1',
    title: 'Idea',
    text: 'A real fact',
    tone: 'TECHNICAL',
    audience: 'Developers',
    goal: 'TEACH',
    targetCredentialId: 'account-1',
    queued: false,
    updatedAt: '2026-10-04',
  };
  let component: ComposeComponent;
  let service: {
    list: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    generate: ReturnType<typeof vi.fn>;
    adapt: ReturnType<typeof vi.fn>;
    listVariants: ReturnType<typeof vi.fn>;
    saveVariant: ReturnType<typeof vi.fn>;
    unqueue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(() => of([draft])),
      save: vi.fn(() => of(draft)),
      approve: vi.fn(() => of({ ...draft, queued: true })),
      generate: vi.fn(),
      adapt: vi.fn(() => of({
        channel: 'X', text: 'Una versión concisa', characterCount: 19,
        recommendedCharacters: 280, publishingAvailable: false,
      })),
      listVariants: vi.fn(() => of([])),
      saveVariant: vi.fn(() => of({
        id: 'variant-1', channel: 'X', text: 'Una versión concisa',
        characterCount: 19, recommendedCharacters: 280, publishingAvailable: false,
        updatedAt: '2026-10-17T12:00:00',
      })),
      unqueue: vi.fn(() => of({ ...draft })),
    };
    TestBed.configureTestingModule({
      imports: [ComposeComponent],
      providers: [
        provideRouter([]),
        { provide: ContentDraftService, useValue: service },
        { provide: CredentialService, useValue: { getLinkedInAccounts: () => of([]) } },
        { provide: AuthService, useValue: { currentUserSignal: signal(null) } },
      ],
    });
    component = TestBed.createComponent(ComposeComponent).componentInstance;
    component.form.patchValue(draft);
    component.text.set(draft.text);
  });

  it('saves a draft without approving it', () => {
    component.save();
    expect(service.save).toHaveBeenCalled();
    expect(service.approve).not.toHaveBeenCalled();
    expect(component.queued()).toBe(false);
  });

  it('saves the edited text before approving', () => {
    component.form.controls.text.setValue('Edited real fact');
    component.review();
    component.save(true);
    expect(service.save.mock.calls[0][0].text).toBe('Edited real fact');
    expect(service.approve).toHaveBeenCalledWith('draft-1');
    expect(component.queued()).toBe(true);
  });

  it('keeps saved draft and edited text if approval fails', () => {
    service.approve.mockReturnValue(
      throwError(() => ({ error: { message: 'Destination unavailable' } })),
    );
    component.review();
    component.save(true);
    expect(component.currentId()).toBe('draft-1');
    expect(component.form.controls.text.value).toBe(draft.text);
    expect(component.error()).toBe('Destination unavailable');
    expect(component.queued()).toBe(false);
  });

  it('requires a selected voice and audience before sending data to AI', () => {
    component.form.controls.tone.setValue('');
    component.generate(false);
    expect(service.generate).not.toHaveBeenCalled();
    expect(component.error()).toBeTruthy();
  });

  it('never erases the author text when generation fails', () => {
    service.generate.mockReturnValue(
      throwError(() => ({ error: { message: 'Vision unavailable' } })),
    );
    component.image.set('data:image/png;base64,test');
    component.generate(true);
    expect(component.form.controls.text.value).toBe(draft.text);
    expect(component.image()).toBeTruthy();
  });

  it('creates a channel-specific preview without replacing the LinkedIn draft', () => {
    component.adaptForChannel('X');

    expect(service.adapt).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Idea', text: 'A real fact', imageUrl: null,
    }), 'X');
    expect(component.adaptedContent()?.text).toBe('Una versión concisa');
    expect(component.form.controls.text.value).toBe('A real fact');
    expect(component.adaptationMessage()).toContain('No se ha guardado ni publicado');
  });

  it('keeps the source text intact when channel adaptation fails', () => {
    service.adapt.mockReturnValue(
      throwError(() => ({ error: { message: 'Provider unavailable' } })),
    );

    component.adaptForChannel('TIKTOK');

    expect(component.form.controls.text.value).toBe('A real fact');
    expect(component.adaptationError()).toBe('Provider unavailable');
    expect(component.adaptationLoading()).toBe(false);
  });

  it('saves a generated variant with its draft without approving or publishing it', () => {
    component.adaptForChannel('X');
    component.saveAdaptedVariant();

    expect(service.save).toHaveBeenCalled();
    expect(service.saveVariant).toHaveBeenCalledWith('draft-1', {
      channel: 'X', text: 'Una versión concisa',
    });
    expect(service.approve).not.toHaveBeenCalled();
    expect(component.savedVariants()).toHaveLength(1);
    expect(component.adaptedContent()?.id).toBe('variant-1');
  });

  it('loads saved variants when opening an existing draft and restores the selected text', () => {
    const saved = {
      id: 'variant-1', channel: 'TIKTOK' as const, text: 'Guion guardado',
      characterCount: 14, recommendedCharacters: 1200, publishingAvailable: false,
    };
    service.listVariants.mockReturnValue(of([saved]));

    component.loadVariants('draft-1');
    component.viewSavedVariant(saved);

    expect(component.savedVariants()).toEqual([saved]);
    expect(component.adaptedContent()?.text).toBe('Guion guardado');
    expect(component.adaptationMessage()).toContain('TikTok');
  });

  it('edits a saved channel variant without changing or approving the LinkedIn draft', () => {
    const saved = {
      id: 'variant-1', channel: 'X' as const, text: 'Versión anterior',
      characterCount: 16, recommendedCharacters: 280, publishingAvailable: false,
    };
    service.saveVariant.mockImplementation((_draftId, value) => of({
      ...saved, text: value.text, characterCount: value.text.length,
    }));
    component.viewSavedVariant(saved);
    component.editAdaptedText({ target: { value: 'Versión corregida' } } as unknown as Event);
    component.saveAdaptedVariant();

    expect(service.saveVariant).toHaveBeenCalledWith('draft-1', {
      channel: 'X', text: 'Versión corregida',
    });
    expect(component.form.controls.text.value).toBe('A real fact');
    expect(component.adaptedContent()?.text).toBe('Versión corregida');
    expect(service.approve).not.toHaveBeenCalled();
  });

  it('keeps unsaved variant edits when the user declines to start another draft', () => {
    const saved = {
      id: 'variant-1', channel: 'TIKTOK' as const, text: 'Guion guardado',
      characterCount: 14, recommendedCharacters: 1200, publishingAvailable: false,
    };
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.viewSavedVariant(saved);
    component.editAdaptedText({ target: { value: 'Guion corregido' } } as unknown as Event);

    component.newDraft();

    expect(component.adaptedText()).toBe('Guion corregido');
    expect(component.adaptedDirty()).toBe(true);
  });

  it('keeps generated text and the saved source draft if saving a variant fails', () => {
    service.saveVariant.mockReturnValue(
      throwError(() => ({ error: { message: 'Variant save failed' } })),
    );
    component.adaptForChannel('X');
    component.saveAdaptedVariant();

    expect(component.currentId()).toBe('draft-1');
    expect(component.adaptedContent()?.text).toBe('Una versión concisa');
    expect(component.adaptationError()).toBe('Variant save failed');
    expect(component.variantSaving()).toBe(false);
    expect(component.busy()).toBe(false);
  });
});
