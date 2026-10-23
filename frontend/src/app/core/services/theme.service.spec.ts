import { ThemeService } from './theme.service';

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('ThemeService accent palettes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.remove('dark', 'light');
    document.body.classList.remove('dark', 'light');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it('uses red as the initial accent and applies the palette to Tailwind tokens', () => {
    const service = new ThemeService();

    expect(service.accentColor()).toBe('red');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#c93640');
    expect(document.documentElement.style.getPropertyValue('--accent-text')).toBe('#f47278');
    expect(document.documentElement.style.getPropertyValue('--color-indigo-600')).toBe('#c93640');
  });

  it.each([
    ['red', '#c93640', '#f47278', '#c93640'],
    ['yellow', '#a16207', '#fbbf24', '#a16207'],
    ['green', '#047857', '#34d399', '#047857'],
    ['blue', '#2563eb', '#60a5fa', '#2563eb'],
  ] as const)('keeps %s accent text readable in both themes', (color, lightText, darkText, accent) => {
    const service = new ThemeService();
    service.setAccentColor(color);

    service.setTheme('light');
    expect(document.documentElement.style.getPropertyValue('--accent-text')).toBe(lightText);
    expect(contrastRatio(lightText, '#f6f7f8')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', accent)).toBeGreaterThanOrEqual(4.5);

    service.setTheme('dark');
    expect(document.documentElement.style.getPropertyValue('--accent-text')).toBe(darkText);
    expect(contrastRatio(darkText, '#0b1020')).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['blue', '#2563eb', '#1e40af', '#93c5fd'],
    ['green', '#047857', '#064e3b', '#6ee7b7'],
    ['yellow', '#a16207', '#713f12', '#fcd34d'],
  ] as const)('applies and persists the %s accent', (color, hex, darkHover, lightActive) => {
    const service = new ThemeService();

    service.setAccentColor(color);

    expect(service.accentColor()).toBe(color);
    expect(localStorage.getItem('accentColor')).toBe(color);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(hex);
    expect(document.documentElement.style.getPropertyValue('--focus')).toBe(hex);
    expect(document.documentElement.style.getPropertyValue('--color-indigo-800')).toBe(darkHover);
    expect(document.documentElement.style.getPropertyValue('--color-indigo-300')).toBe(lightActive);
  });

  it('keeps the accent independent from light and dark mode', () => {
    const service = new ThemeService();
    service.setAccentColor('green');

    service.setTheme('light');

    expect(service.accentColor()).toBe('green');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#047857');
    expect(document.documentElement.style.getPropertyValue('--accent-text')).toBe('#047857');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
