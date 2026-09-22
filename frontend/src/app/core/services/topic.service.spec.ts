import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TopicService } from './topic.service';
import { BackupTopic, InterestTopic } from '../models/topic.model';

describe('TopicService', () => {
  let service: TopicService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TopicService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(TopicService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch backup topics', () => {
    const mockTopics: BackupTopic[] = [
      { id: '1', title: 'Spring Boot 3', category: 'BACKEND', priority: 1, isUsed: false, createdAt: '2026-08-14' }
    ];

    service.getBackupTopics().subscribe((res) => {
      expect(res.length).toBe(1);
      expect(res[0].title).toBe('Spring Boot 3');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/topics/backup');
    expect(req.request.method).toBe('GET');
    req.flush(mockTopics);
  });

  it('should add a new backup topic', () => {
    const newTopic: BackupTopic = {
      id: '2',
      title: 'Angular Signals',
      description: 'Guía práctica',
      category: 'FRONTEND',
      priority: 2,
      isUsed: false,
      createdAt: '2026-08-14'
    };

    service.addBackupTopic('Angular Signals', 'Guía práctica', 'FRONTEND', 2).subscribe((res) => {
      expect(res.id).toBe('2');
      expect(res.title).toBe('Angular Signals');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/topics/backup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'Angular Signals',
      description: 'Guía práctica',
      category: 'FRONTEND',
      priority: 2
    });
    req.flush(newTopic);
  });

  it('should delete a backup topic', () => {
    service.deleteBackupTopic('1').subscribe();

    const req = httpMock.expectOne('http://localhost:8080/api/v1/topics/backup/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('should fetch interest topics', () => {
    const mockInterests: InterestTopic[] = [
      { id: 'int-1', topicName: 'AI Engineering', isActive: true, createdAt: '2026-08-14' }
    ];

    service.getInterestTopics().subscribe((res) => {
      expect(res.length).toBe(1);
      expect(res[0].topicName).toBe('AI Engineering');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/topics/interests');
    expect(req.request.method).toBe('GET');
    req.flush(mockInterests);
  });
});
