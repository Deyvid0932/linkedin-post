import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CredentialService } from '../../core/services/credential.service';
import { GitHubQueueService } from '../../core/services/github-queue.service';
import { CalendarComponent } from './calendar.component';

describe('CalendarComponent', () => {
  let component: CalendarComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        provideRouter([]),
        { provide: CredentialService, useValue: { getMonitoredRepos: () => of([]) } },
        {
          provide: GitHubQueueService,
          useValue: { load: () => of({ posts: [] }), schedule: () => of({ queue: { posts: [] } }) },
        },
      ],
    });
    component = TestBed.createComponent(CalendarComponent).componentInstance;
  });

  it('builds a six-week month grid beginning on Monday', () => {
    const days = component.monthDays();
    expect(days).toHaveLength(42);
    expect((days[0].date.getDay() + 6) % 7).toBe(0);
    expect(days[41].date.getTime()).toBeGreaterThan(days[0].date.getTime());
  });

  it('lets only untouched scheduled posts be moved', () => {
    const pending = {
      id: 'pending',
      text: 'Draft',
      hasImage: false,
      publishAt: '2030-03-04T13:00:00Z',
      status: 'SCHEDULED',
      attemptedAt: null,
      postUrn: null,
    };
    const attempted = { ...pending, id: 'attempted', attemptedAt: '2030-03-03T13:00:00Z' };
    const published = { ...pending, id: 'published', status: 'SUCCESS' };
    expect(component.canReschedule(pending)).toBe(true);
    expect(component.canReschedule(attempted)).toBe(false);
    expect(component.canReschedule(published)).toBe(false);
    expect(component.statusLabel('SUCCESS')).toBe('Publicado confirmado');
  });
});
