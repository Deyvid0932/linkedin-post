import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AutomationStateService } from '../../../core/services/automation-state.service';
import { HeaderComponent } from './header.component';

describe('Header navigation search', () => {
  const roles = signal<string[]>(['USER']);
  const navigateByUrl = vi.fn();
  const automation = {
    enabled: signal<boolean | null>(false),
    loading: signal(false),
    busy: signal(false),
    error: signal(''),
    label: () => 'Publicación pausada',
    explanation: 'Estado del backend',
    load: vi.fn(),
    toggle: vi.fn(),
  };

  beforeEach(async () => {
    roles.set(['USER']);
    navigateByUrl.mockReset();
    automation.load.mockReset();
    TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        { provide: AuthService, useValue: { currentUserSignal: () => ({ roles: roles() }) } },
        { provide: AutomationStateService, useValue: automation },
      ],
    });
    await TestBed.compileComponents();
  });

  it('opens from the search button, filters routes, and navigates with Enter', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.app-search-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);

    const input = dialog.querySelector('input') as HTMLInputElement;
    input.value = 'ideas';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(dialog.querySelectorAll('[role="option"]').length).toBe(1);
    expect(dialog.textContent).toContain('Banco de ideas');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(navigateByUrl).toHaveBeenCalledWith('/topics');
    expect(dialog.open).toBe(false);
  });

  it('opens from Ctrl+K and only shows administration to administrators', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    fixture.detectChanges();
    let dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).not.toContain('Administración');

    fixture.componentInstance.closeSearch();
    roles.set(['ROLE_ADMIN']);
    fixture.detectChanges();
    fixture.componentInstance.openSearch();
    fixture.detectChanges();
    dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.textContent).toContain('Administración');
  });

  it('keeps the publishing calendar separate from recurring schedule settings', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.updateSearch('calendario');
    expect(component.results().map((command) => command.route)).toEqual(['/calendar']);
    expect(component.results()[0].group).toBe('Crear y publicar');
    component.navigate(component.results()[0]);

    component.updateSearch('horarios');
    expect(component.results().map((command) => command.route)).toEqual(['/settings/schedule']);
    expect(component.results()[0].group).toBe('Ajustes');
    component.navigate(component.results()[0]);

    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/calendar');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/settings/schedule');
  });

  it('moves the active result with arrows and restores focus after Escape', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('.app-search-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const input = dialog.querySelector('input') as HTMLInputElement;
    input.value = 'publicar';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(dialog.querySelector('[aria-selected="true"]')?.textContent).toContain(
      'Crear publicación',
    );

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
