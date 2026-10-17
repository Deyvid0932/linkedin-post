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
    unqueue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      list: vi.fn(() => of([draft])),
      save: vi.fn(() => of(draft)),
      approve: vi.fn(() => of({ ...draft, queued: true })),
      generate: vi.fn(),
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
});
