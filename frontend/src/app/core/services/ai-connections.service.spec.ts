import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AiConnectionsService, AiProviderStatus } from './ai-connections.service';
import { environment } from '../../../environments/environment';

describe('AiConnectionsService', () => {
  let service: AiConnectionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AiConnectionsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AiConnectionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads safe provider status without requesting secret values', () => {
    const statuses: AiProviderStatus[] = [{
      provider: 'deepseek-text', label: 'DeepSeek · generación de texto',
      workspaceKeyConfigured: true, serverFallbackConfigured: false,
      effectiveSource: 'WORKSPACE', updatedAt: null,
    }];
    service.getStatuses().subscribe(result => expect(result).toEqual(statuses));
    const req = http.expectOne(`${environment.apiUrl}/ai-connections`);
    expect(req.request.method).toBe('GET');
    req.flush(statuses);
  });

  it('sends a key only in the authenticated save request body', () => {
    service.save('nanogpt-image', 'private-test-key').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/ai-connections/nanogpt-image`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ apiKey: 'private-test-key' });
    req.flush({
      provider: 'nanogpt-image', label: 'NanoGPT · generación de imágenes',
      workspaceKeyConfigured: true, serverFallbackConfigured: true,
      effectiveSource: 'WORKSPACE', updatedAt: null,
    });
  });

  it('loads the curated image model catalog without secret data', () => {
    const catalog = [{ id: 'qwen-image-2.1/text-to-image', name: 'Qwen Image 2.1', estimatedPriceUsd: 0.02 }];
    service.getImageModels().subscribe(result => expect(result).toEqual(catalog));
    const req = http.expectOne(`${environment.apiUrl}/ai-connections/image-models`);
    expect(req.request.method).toBe('GET');
    req.flush(catalog);
  });
});
