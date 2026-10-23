import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { WebhookDelivery, WebhookEndpoint, WebhookEventName, WebhookService } from '../../../core/services/webhook.service';

@Component({
  selector: 'app-webhooks',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './webhooks.component.html',
  styleUrl: './webhooks.component.css',
})
export class WebhooksComponent implements OnInit {
  private readonly api = inject(WebhookService);
  readonly eventOptions: { id: WebhookEventName; label: string; detail: string }[] = [
    { id: 'post.published', label: 'Publicación confirmada', detail: 'LinkedIn confirmó que el post fue publicado.' },
    { id: 'post.delivery_unknown', label: 'Resultado sin confirmar', detail: 'El envío se inició, pero AutoPost no pudo confirmar su resultado.' },
  ];
  readonly endpoints = signal<WebhookEndpoint[]>([]);
  readonly deliveries = signal<WebhookDelivery[]>([]);
  readonly selectedEvents = signal<WebhookEventName[]>(['post.published', 'post.delivery_unknown']);
  readonly name = signal('');
  readonly targetUrl = signal('');
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly loadingEndpoints = signal(true);
  readonly loadingDeliveries = signal(true);
  readonly saving = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly oneTimeSecret = signal('');
  readonly secretCopied = signal(false);

  ngOnInit(): void { this.loadEndpoints(); this.loadDeliveries(0); }

  loadEndpoints(): void {
    this.loadingEndpoints.set(true);
    this.error.set('');
    this.api.listEndpoints().pipe(finalize(() => this.loadingEndpoints.set(false))).subscribe({
      next: data => this.endpoints.set(data),
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudieron cargar los destinos webhook.'),
    });
  }

  loadDeliveries(page: number): void {
    this.loadingDeliveries.set(true);
    this.api.listDeliveries(page).pipe(finalize(() => this.loadingDeliveries.set(false))).subscribe({
      next: result => { this.deliveries.set(result.content); this.page.set(result.number); this.totalPages.set(result.totalPages); },
      error: () => this.error.set('No se pudo cargar el registro de entregas. Puedes volver a intentarlo.'),
    });
  }

  setName(value: string): void { this.name.set(value); }
  setUrl(value: string): void { this.targetUrl.set(value); }

  toggleEvent(event: WebhookEventName, checked: boolean): void {
    this.selectedEvents.update(items => checked ? [...new Set([...items, event])] : items.filter(item => item !== event));
  }

  create(): void {
    const name = this.name().trim();
    const targetUrl = this.targetUrl().trim();
    if (!name || !targetUrl || !this.selectedEvents().length) {
      this.error.set('Completa el nombre, la URL HTTPS y al menos un tipo de evento.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.create(name, targetUrl, this.selectedEvents()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: created => {
        this.endpoints.update(items => [created.endpoint, ...items]);
        this.name.set(''); this.targetUrl.set('');
        this.oneTimeSecret.set(created.secret); this.secretCopied.set(false);
        this.message.set('Destino creado. Guarda ahora el secreto de firma; solo se mostrará esta vez.');
      },
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudo crear el webhook. Comprueba la URL HTTPS pública.'),
    });
  }

  copySecret(): void {
    const secret = this.oneTimeSecret();
    if (!secret || !navigator.clipboard) return;
    navigator.clipboard.writeText(secret).then(() => this.secretCopied.set(true))
      .catch(() => this.error.set('No se pudo copiar el secreto. Selecciónalo y cópialo manualmente.'));
  }

  dismissSecret(): void { this.oneTimeSecret.set(''); this.secretCopied.set(false); }

  toggleActive(endpoint: WebhookEndpoint): void {
    this.busyId.set(endpoint.id); this.error.set(''); this.message.set('');
    this.api.setActive(endpoint.id, !endpoint.active).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: updated => this.replaceEndpoint(updated),
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudo actualizar el destino.'),
    });
  }

  delete(endpoint: WebhookEndpoint): void {
    if (!window.confirm(`¿Eliminar el destino ${endpoint.name}? También se eliminará su historial de entregas.`)) return;
    this.busyId.set(endpoint.id); this.error.set(''); this.message.set('');
    this.api.delete(endpoint.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: () => this.endpoints.update(items => items.filter(item => item.id !== endpoint.id)),
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudo eliminar el destino.'),
    });
  }

  test(endpoint: WebhookEndpoint): void {
    this.busyId.set(endpoint.id); this.error.set(''); this.message.set('');
    this.api.sendTest(endpoint.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: result => {
        this.message.set(result.status === 'DELIVERED' ? 'La prueba se entregó correctamente.' : 'La prueba falló; revisa el detalle y reintenta cuando el destino esté disponible.');
        this.loadDeliveries(0);
      },
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudo probar el destino.'),
    });
  }

  retry(delivery: WebhookDelivery): void {
    if (delivery.status === 'DELIVERED') return;
    this.busyId.set(delivery.id); this.error.set(''); this.message.set('');
    this.api.retry(delivery.id).pipe(finalize(() => this.busyId.set(null))).subscribe({
      next: result => {
        this.message.set(result.status === 'DELIVERED' ? 'El reintento se entregó correctamente.' : 'El reintento volvió a fallar.');
        this.loadDeliveries(this.page());
      },
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'No se pudo reintentar la entrega.'),
    });
  }

  private replaceEndpoint(updated: WebhookEndpoint): void {
    this.endpoints.update(items => items.map(item => item.id === updated.id ? updated : item));
  }
}
