import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  let fixture: ComponentFixture<TopicsComponent>;
  let service: {
    getTopics: ReturnType<typeof vi.fn>;
    reorderTopics: ReturnType<typeof vi.fn>;
    toggleTopicUsed: ReturnType<typeof vi.fn>;
    exploreIdeas: ReturnType<typeof vi.fn>;
    getRecentSignals: ReturnType<typeof vi.fn>;
    addTopic: ReturnType<typeof vi.fn>;
    addBulkTopics: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    service = {
      getTopics: vi.fn(() => of(topics)),
      reorderTopics: vi.fn(() => of({ message: 'ok', count: 2 })),
      toggleTopicUsed: vi.fn(() => of({ ...topics[0], isUsed: true })),
      exploreIdeas: vi.fn(() => of({
        niche: 'Spring Boot',
        ideas: ['Diseño de APIs resilientes con Spring Boot', 'Angular Signals'],
        source: 'IA',
      })),
      getRecentSignals: vi.fn(() => of({
        niche: 'Spring Boot',
        source: 'Hacker News · Algolia · últimos 7 días',
        fetchedAt: '2026-10-17T12:00:00Z',
        signals: [{
          id: '123', title: 'Safer APIs with Spring Boot',
          discussionUrl: 'https://news.ycombinator.com/item?id=123',
          points: 42, comments: 12, createdAt: '2026-10-16T12:00:00Z',
        }],
      })),
      addTopic: vi.fn(() => of({
        id: 'trend-1', title: 'Safer APIs with Spring Boot', category: 'Backend & Cloud',
        priority: 0, isUsed: false, createdAt: '2026-10-17',
      })),
      addBulkTopics: vi.fn(() => of({ message: 'ok', importedCount: 1 })),
    };
    TestBed.configureTestingModule({
      imports: [TopicsComponent],
      providers: [provideRouter([]), { provide: TopicService, useValue: service }],
    });
    fixture = TestBed.createComponent(TopicsComponent);
    component = fixture.componentInstance;
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

  it('summarizes actual ideas by status and category', () => {
    expect(component.countAvailable()).toBe(1);
    expect(component.countInvestigated()).toBe(1);
    expect(component.categoryBreakdown()).toEqual([
      { name: 'Backend & Cloud', count: 1 },
      { name: 'Frontend Web', count: 1 },
    ]);
  });

  it('keeps the ideas bank and trend exploration in separate, accessible views', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Resumen del banco');
    expect(fixture.nativeElement.textContent).not.toContain('Explorar un nicho');

    component.activeMode.set('explore');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Explorar un nicho');
    expect(fixture.nativeElement.textContent).not.toContain('Resumen del banco');
    expect(fixture.nativeElement.querySelector('[aria-pressed="true"]')?.textContent)
      .toContain('Explorar señales');
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

  it('ignores stale reorder actions while a status filter or search is active', () => {
    component.filterMode.set('AVAILABLE');
    component.movePriority('a', 1);
    expect(service.reorderTopics).not.toHaveBeenCalled();
    expect(component.topics().map((topic) => topic.id)).toEqual(['a', 'b']);

    component.filterMode.set('ALL');
    component.searchQuery.set('Angular');
    component.movePriority('a', 1);
    expect(service.reorderTopics).not.toHaveBeenCalled();
    expect(component.topics().map((topic) => topic.id)).toEqual(['a', 'b']);
  });

  it('marks ideas already in the bank and only saves selected new ideas', () => {
    component.explorationNiche = 'Spring Boot';
    component.exploreNiche();

    expect(component.exploredIdeas()).toEqual([
      { title: 'Diseño de APIs resilientes con Spring Boot', alreadyInBank: false, selected: true },
      { title: 'Angular Signals', alreadyInBank: true, selected: false },
    ]);

    component.saveExploredIdeas();

    expect(service.addBulkTopics).toHaveBeenCalledWith({
      backupTopics: [{
        title: 'Diseño de APIs resilientes con Spring Boot',
        category: 'Backend & Cloud',
        isAiResearch: true,
        priority: 0,
      }],
      isAiResearchDefault: true,
    });
    expect(component.exploredIdeas()[0].alreadyInBank).toBe(true);
    expect(component.feedbackNotice()).toContain('1 ideas seleccionadas');
  });

  it('keeps niche input and allows retry after an AI error', () => {
    service.exploreIdeas.mockReturnValue(throwError(() => new Error('offline')));
    component.explorationNiche = 'PostgreSQL';

    component.exploreNiche();

    expect(component.explorationNiche).toBe('PostgreSQL');
    expect(component.explorationError()).toContain('No se pudieron generar ideas');
    expect(component.exploring()).toBe(false);
  });

  it('does not claim the ideas bank is empty when its initial load fails, and can retry', () => {
    service.getTopics.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.topics.set([]);
    fixture.detectChanges();

    expect(component.topicsLoadFailed()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No pudimos comprobar el contenido del banco');
    expect(fixture.nativeElement.textContent).not.toContain('No hay ideas para mostrar');
    expect(fixture.nativeElement.textContent).toContain('No disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Total');

    component.loadTopics();
    fixture.detectChanges();

    expect(component.topicsLoadFailed()).toBe(false);
    expect(component.topics()).toEqual(topics);
    expect(component.feedbackNotice()).toBeNull();
  });

  it('shows recent source signals and saves one only after explicit selection', () => {
    component.explorationNiche = 'Spring Boot';

    component.searchRecentSignals();

    expect(service.getRecentSignals).toHaveBeenCalledWith('Spring Boot', '7d');
    expect(component.recentSignals()).toHaveLength(1);
    expect(component.signalsNiche()).toBe('Spring Boot');
    expect(component.signalsFetchedAt()).toBe('2026-10-17T12:00:00Z');
    expect(component.signalAlreadySaved(component.recentSignals()[0])).toBe(false);

    component.saveSignal(component.recentSignals()[0]);

    expect(service.addTopic).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Safer APIs with Spring Boot',
      isAiResearch: true,
    }));
    expect(component.signalAlreadySaved(component.recentSignals()[0])).toBe(true);
  });

  it('keeps a signal available and retries its save without repeating the search', () => {
    component.explorationNiche = 'Spring Boot';
    component.searchRecentSignals();
    const signal = component.recentSignals()[0];
    service.addTopic.mockReturnValueOnce(throwError(() => new Error('offline')));

    component.saveSignal(signal);

    expect(component.signalSaveErrorId()).toBe(signal.id);
    expect(component.recentSignals()).toContain(signal);
    expect(service.getRecentSignals).toHaveBeenCalledTimes(1);

    component.saveSignal(signal);

    expect(service.addTopic).toHaveBeenCalledTimes(2);
    expect(component.signalSaveErrorId()).toBeNull();
    expect(component.signalAlreadySaved(signal)).toBe(true);
  });

  it('filters fetched signals by the detected topic category without changing the source results', () => {
    component.recentSignals.set([
      {
        id: '123', title: 'Safer APIs with Spring Boot',
        discussionUrl: 'https://news.ycombinator.com/item?id=123',
        points: 42, comments: 12, createdAt: '2026-10-16T12:00:00Z',
      },
      {
        id: '124', title: 'Angular Signals in the frontend',
        discussionUrl: 'https://news.ycombinator.com/item?id=124',
        points: 18, comments: 4, createdAt: '2026-10-16T13:00:00Z',
      },
    ]);
    component.signalCategory.set('Frontend Web');

    expect(component.filteredRecentSignals().map((signal) => signal.id)).toEqual(['124']);
    expect(component.signalSummary()).toEqual({ count: 1, points: 18, comments: 4 });
    expect(component.recentSignals()).toHaveLength(2);
  });

  it('reloads signals when the selected period changes after a search', () => {
    component.explorationNiche = 'Spring Boot';
    component.searchRecentSignals();

    component.setSignalsPeriod('24h');

    expect(service.getRecentSignals).toHaveBeenLastCalledWith('Spring Boot', '24h');
    expect(component.signalsWindowLabel()).toBe('últimas 24 horas');
  });
});
