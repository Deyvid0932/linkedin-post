import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { WebhookService } from './webhook.service';
import { environment } from '../../../environments/environment';

describe('WebhookService', () => {
  let api: WebhookService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WebhookService, provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(WebhookService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates a webhook with selected event subscriptions and receives the one-time secret', () => {
    api.create('Deploy', 'https://example.com/hooks/autopost', ['post.published']).subscribe(result => {
      expect(result.secret).toBe('one-time-secret');
      expect(result.endpoint.targetHost).toBe('example.com');
    });
    const req = http.expectOne(`${environment.apiUrl}/webhooks`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.events).toEqual(['post.published']);
    req.flush({ endpoint: { id: 'wh1', name: 'Deploy', targetHost: 'example.com', events: ['post.published'], active: true, secretConfigured: true, createdAt: '' }, secret: 'one-time-secret' });
  });

  it('requests delivery history from the authenticated workspace API', () => {
    api.listDeliveries(2, 10).subscribe();
    const req = http.expectOne(request => request.url === `${environment.apiUrl}/webhooks/deliveries`
      && request.params.get('page') === '2' && request.params.get('size') === '10');
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], number: 2, size: 10, totalElements: 0, totalPages: 0 });
  });
});
