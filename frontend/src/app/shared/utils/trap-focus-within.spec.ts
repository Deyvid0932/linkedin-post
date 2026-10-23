import { trapFocusWithin } from './trap-focus-within';

describe('trapFocusWithin', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <a href="/first">Primero</a>
      <button id="middle">Medio</button>
      <button id="last">Último</button>
      <details><summary>Perfil</summary><a href="/hidden">Oculto</a></details>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => container.remove());

  it('wraps forward tab from the last control to the first', () => {
    const first = container.querySelector('a[href="/first"]') as HTMLAnchorElement;
    const lastVisible = container.querySelector('summary') as HTMLElement;
    lastVisible.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    trapFocusWithin(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps reverse tab from the first control to the last', () => {
    const first = container.querySelector('a[href="/first"]') as HTMLAnchorElement;
    const last = container.querySelector('summary') as HTMLElement;
    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });

    trapFocusWithin(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('returns focus into the drawer when tab starts outside it', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const first = container.querySelector('a[href="/first"]') as HTMLAnchorElement;
    outside.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });

    trapFocusWithin(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    outside.remove();
  });

  it('does not interfere with other keys or tabs in the middle', () => {
    const middle = container.querySelector('#middle') as HTMLButtonElement;
    middle.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

    trapFocusWithin(tab, container);
    trapFocusWithin(arrow, container);

    expect(tab.defaultPrevented).toBe(false);
    expect(arrow.defaultPrevented).toBe(false);
  });
});
