import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WebhookService } from '../../../core/services/webhook.service';
import { WebhooksComponent } from './webhooks.component';

describe('WebhooksComponent', () => {
  let component: WebhooksComponent;
  let api: { listEndpoints: ReturnType<typeof vi.fn>; listDeliveries: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      listEndpoints: vi.fn(() => of([])),
      listDeliveries: vi.fn(() => of({ content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 })),
      create: vi.fn(() => of({ endpoint: { id: 'wh1', name: 'Deploy', targetHost: 'example.com', events: ['post.published'], active: true, secretConfigured: true, createdAt: '' }, secret: 'secret-only-once' })),
    };
    TestBed.configureTestingModule({ imports: [WebhooksComponent], providers: [{ provide: WebhookService, useValue: api }] });
    component = TestBed.createComponent(WebhooksComponent).componentInstance;
    component.ngOnInit();
  });

  it('creates a destination and reveals the signature secret once', () => {
    component.setName('Deploy');
    component.setUrl('https://example.com/hooks/autopost');
    component.create();
    expect(api.create).toHaveBeenCalledWith('Deploy', 'https://example.com/hooks/autopost', ['post.published', 'post.delivery_unknown']);
    expect(component.endpoints()).toHaveLength(1);
    expect(component.oneTimeSecret()).toBe('secret-only-once');
    component.dismissSecret();
    expect(component.oneTimeSecret()).toBe('');
  });

  it('keeps form values and reports the server validation if creation fails', () => {
    api.create.mockReturnValue(throwError(() => ({ error: { message: 'El destino debe ser HTTPS' } })));
    component.setName('My hook');
    component.setUrl('http://example.com/hook');
    component.create();
    expect(component.name()).toBe('My hook');
    expect(component.targetUrl()).toBe('http://example.com/hook');
    expect(component.error()).toBe('El destino debe ser HTTPS');
  });
});
