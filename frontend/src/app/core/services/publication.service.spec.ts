import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PublicationService, PageResponse } from './publication.service';
import { PublicationLog, GeneratedPreview } from '../models/publication.model';

describe('PublicationService', () => {
  let service: PublicationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PublicationService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PublicationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should get paginated publication history', () => {
    const mockPage: PageResponse<PublicationLog> = {
      content: [
        {
          id: 'pub-1',
          sourceMode: 'PROJECT',
          status: 'SUCCESS',
          generatedText: 'Test post content',
          imageUrl: 'https://example.com/img.png',
          linkedinPostUrn: 'urn:li:share:123',
          sourceReference: 'repo/commit-1',
          createdAt: '2026-08-14T12:00:00Z',
          publishedAt: '2026-08-14T12:01:00Z'
        }
      ],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0
    };

    service.getHistory(0, 10).subscribe((res) => {
      expect(res.content.length).toBe(1);
      expect(res.content[0].id).toBe('pub-1');
      expect(res.content[0].generatedText).toBe('Test post content');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/publications?page=0&size=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('should trigger pipeline execution', () => {
    service.triggerPipeline().subscribe((res) => {
      expect(res.message).toBe('Pipeline triggered successfully');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/publications/trigger');
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Pipeline triggered successfully' });
  });

  it('should delete a publication', () => {
    service.deletePublication('pub-1').subscribe();

    const req = httpMock.expectOne('http://localhost:8080/api/v1/publications/pub-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should get generated preview', () => {
    const mockPreview: GeneratedPreview = {
      sourceMode: 'PROJECT',
      generatedText: 'Preview generated content',
      imageUrl: 'https://example.com/preview.png',
      sourceReference: 'Signals in Angular'
    };

    service.getPreview().subscribe((res) => {
      expect(res.generatedText).toBe('Preview generated content');
      expect(res.sourceMode).toBe('PROJECT');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/publications/preview');
    expect(req.request.method).toBe('GET');
    req.flush(mockPreview);
  });
});
