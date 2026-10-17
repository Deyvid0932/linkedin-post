import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  viewChild,
} from '@angular/core';

/** Native modal semantics provide keyboard focus containment and Escape handling. */
@Component({
  selector: 'app-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
})
export class DialogComponent implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly side = input(false);
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;
  ngAfterViewInit(): void {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.dialog().nativeElement.showModal();
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
  ngOnDestroy(): void {
    this.dialog().nativeElement.close();
    this.opener?.focus();
  }
}
