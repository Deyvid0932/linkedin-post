import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TopicService } from '../../core/services/topic.service';
import { BackupTopic } from '../../core/models/topic.model';
import { TopicsComponent } from './topics.component';

describe('TopicsComponent', () => {
  const topics: BackupTopic[] = [
    {
      id: 'a',
      title: 'Angular Signals',
      category: 'Frontend Web',
      priority: 2,
      isUsed: false,
      createdAt: '2026-10-01',
    },
    {
      id: 'b',
      title: 'Spring Boot APIs',
      category: 'Backend & Cloud',
      priority: 1,
      isUsed: true,
      createdAt: '2026-10-02',
    },
  ];
  let component: TopicsComponent;
  let service: {
    getTopics: ReturnType<typeof vi.fn>;
    reorderTopics: ReturnType<typeof vi.fn>;
    toggleTopicUsed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getTopics: vi.fn(() => of(topics)),
      reorderTopics: vi.fn(() => of({ message: 'ok', count: 2 })),
      toggleTopicUsed: vi.fn(() => of({ ...topics[0], isUsed: true })),
    };
    TestBed.configureTestingModule({
      imports: [TopicsComponent],
      providers: [provideRouter([]), { provide: TopicService, useValue: service }],
    });
    component = TestBed.createComponent(TopicsComponent).componentInstance;
    component.topics.set(topics);
  });

  it('filters by status and search without enabling priority changes', () => {
    component.filterMode.set('AVAILABLE');
    expect(component.filteredTopics().map((topic) => topic.id)).toEqual(['a']);
    expect(component.reorderEnabled()).toBe(false);
    component.filterMode.set('ALL');
    component.searchQuery.set('spring');
    expect(component.filteredTopics().map((topic) => topic.id)).toEqual(['b']);
    expect(component.reorderEnabled()).toBe(false);
  });

  it('reorders the full list only when unfiltered and restores order if saving fails', () => {
    service.reorderTopics.mockReturnValue(throwError(() => new Error('offline')));
    component.movePriority('b', -1);
    expect(service.reorderTopics).toHaveBeenCalledWith([
      { id: 'b', priority: 2 },
      { id: 'a', priority: 1 },
    ]);
    expect(component.topics().map((topic) => topic.id)).toEqual(['a', 'b']);
    expect(component.feedbackNotice()).toContain('No se pudo cambiar el orden');
  });
});
