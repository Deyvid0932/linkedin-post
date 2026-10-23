import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AccentColor, TenantAppearancePolicyRequest } from '../../../core/models/tenant.model';
import { AppearanceComponent } from './appearance.component';

describe('AppearanceComponent', () => {
  const settings = (overrides: Partial<{
    userAccentColor: 'red' | 'blue' | 'green' | 'yellow';
    defaultAccentColor: 'red' | 'blue' | 'green' | 'yellow';
    allowedAccentColors: ('red' | 'blue' | 'green' | 'yellow')[];
    administrator: boolean;
  }> = {}) => ({
    userAccentColor: 'red' as const,
    defaultAccentColor: 'red' as const,
    allowedAccentColors: ['red', 'blue', 'green', 'yellow'] as ('red' | 'blue' | 'green' | 'yellow')[],
    administrator: false,
    ...overrides,
  });

  let fixture: ComponentFixture<AppearanceComponent>;
  let tenant: {
    getAppearance: ReturnType<typeof vi.fn>;
    updateAppearancePolicy: ReturnType<typeof vi.fn>;
    updateUserAccent: ReturnType<typeof vi.fn>;
  };
  let currentUserSignal: ReturnType<typeof signal>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    currentUserSignal = signal({
      userId: 'u1',
      tenantId: 't1',
      name: 'Deyvid',
      email: 'deyvid@example.com',
      roles: ['ROLE_USER'],
    });
    tenant = {
      getAppearance: vi.fn(() => of(settings({ allowedAccentColors: ['red', 'yellow'] }))),
      updateAppearancePolicy: vi.fn((policy: TenantAppearancePolicyRequest) => of(settings({
        defaultAccentColor: policy.defaultAccentColor,
        allowedAccentColors: policy.allowedAccentColors,
        administrator: true,
      }))),
      updateUserAccent: vi.fn((accentColor: AccentColor) => of(settings({
        userAccentColor: accentColor,
        allowedAccentColors: ['red', 'yellow'],
      }))),
    };
    TestBed.configureTestingModule({
      imports: [AppearanceComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUserSignal } },
        { provide: TenantService, useValue: tenant },
      ],
    });
    fixture = TestBed.createComponent(AppearanceComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it('lets users choose only colors permitted by the administrator and saves their preference', () => {
    const component = fixture.componentInstance;
    const radio = (name: string) => fixture.nativeElement.querySelector(`[role="radio"][aria-label="${name}"]`) as HTMLButtonElement;

    expect(radio('Azul').disabled).toBe(true);
    expect(radio('Verde').disabled).toBe(true);
    expect(radio('Amarillo').disabled).toBe(false);

    component.choose('yellow');
    component.saveUserPreference();
    fixture.detectChanges();

    expect(tenant.updateUserAccent).toHaveBeenCalledWith('yellow');
    expect(component.selected()).toBe('yellow');
    expect(TestBed.inject(ThemeService).accentColor()).toBe('yellow');
    expect(component.success()).toContain('se guardó');
  });

  it('reloads the current palette when the administrator disables a color during editing', () => {
    const component = fixture.componentInstance;
    tenant.updateUserAccent.mockReturnValue(throwError(() => ({
      error: { message: 'Este color ya no está habilitado por la administración.' },
    })));
    tenant.getAppearance.mockReturnValue(of(settings({
      userAccentColor: 'red',
      allowedAccentColors: ['red'],
    })));

    component.choose('yellow');
    component.saveUserPreference();
    fixture.detectChanges();

    expect(component.allowed()).toEqual(['red']);
    expect(component.selected()).toBe('red');
    expect(TestBed.inject(ThemeService).accentColor()).toBe('red');
    expect(component.loadFailed()).toBe(false);
    expect(component.error()).toContain('ya no está habilitado');
  });

  it('hides stale palette controls when a rejected color cannot be reconciled with the server', () => {
    const component = fixture.componentInstance;
    tenant.updateUserAccent.mockReturnValue(throwError(() => ({
      error: { message: 'Este color ya no está habilitado por la administración.' },
    })));
    tenant.getAppearance.mockReturnValue(throwError(() => new Error('offline')));

    component.choose('yellow');
    component.saveUserPreference();
    fixture.detectChanges();

    expect(component.loadFailed()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
    expect(component.error()).toContain('ya no está habilitado');
  });

  it('moves keyboard focus through permitted colors and keeps one radio in the tab order', () => {
    const component = fixture.componentInstance;
    const radio = (name: string) => fixture.nativeElement.querySelector(`[role="radio"][aria-label="${name}"]`) as HTMLButtonElement;
    const red = radio('Rojo');

    expect(red.tabIndex).toBe(0);
    expect(radio('Amarillo').tabIndex).toBe(-1);

    red.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(component.selected()).toBe('yellow');
    expect(document.activeElement).toBe(radio('Amarillo'));
    expect(radio('Amarillo').tabIndex).toBe(0);
    expect(radio('Azul').disabled).toBe(true);
  });

  it('shows global palette controls only to administrators and persists their policy', () => {
    tenant.getAppearance.mockReturnValue(of(settings({ administrator: true })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(fixture.nativeElement.textContent).toContain('Paleta disponible para los usuarios');
    component.toggleAllowed('blue', false);
    component.toggleAllowed('green', false);
    component.setDefault('yellow');
    component.savePolicy();

    expect(tenant.updateAppearancePolicy).toHaveBeenCalledWith({
      defaultAccentColor: 'yellow',
      allowedAccentColors: ['red', 'yellow'],
    });
    expect(component.success()).toContain('guardadas');
  });

  it('keeps at least one color enabled and freezes policy controls during save', () => {
    tenant.getAppearance.mockReturnValue(of(settings({
      administrator: true,
      allowedAccentColors: ['red'],
    })));
    fixture.componentInstance.load();
    fixture.detectChanges();

    const inputs = () => [...fixture.nativeElement.querySelectorAll('.admin-option input')] as HTMLInputElement[];
    expect(inputs()[0].checked).toBe(true);
    expect(inputs()[0].disabled).toBe(true);

    const pendingSave = new Subject<ReturnType<typeof settings>>();
    tenant.updateAppearancePolicy.mockReturnValueOnce(pendingSave.asObservable());
    fixture.componentInstance.savePolicy();
    fixture.detectChanges();

    expect(inputs().every((input) => input.disabled)).toBe(true);
    expect((fixture.nativeElement.querySelector('#default-accent') as HTMLSelectElement).disabled).toBe(true);

    pendingSave.next(settings({ administrator: true, allowedAccentColors: ['red'] }));
    pendingSave.complete();
    fixture.detectChanges();

    expect(inputs()[0].disabled).toBe(true);
    expect((fixture.nativeElement.querySelector('#default-accent') as HTMLSelectElement).disabled).toBe(false);
  });

  it('hides palette controls after a failed policy load and recovers on retry', () => {
    const component = fixture.componentInstance;
    tenant.getAppearance.mockReturnValue(throwError(() => new Error('offline')));

    component.load();
    fixture.detectChanges();

    expect(component.loadFailed()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar tu apariencia');
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).toBeNull();

    tenant.getAppearance.mockReturnValue(of(settings({ allowedAccentColors: ['red', 'yellow'] })));
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Reintentar');
    retry?.click();
    fixture.detectChanges();

    expect(component.loadFailed()).toBe(false);
    expect(component.error()).toBe('');
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).not.toBeNull();
  });
});
