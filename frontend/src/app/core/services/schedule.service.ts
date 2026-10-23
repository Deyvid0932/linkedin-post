import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Schedule {
  id: string;
  cronExpression: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface PostingDistribution {
  postsByHour: Record<string, number>;
  postsByDayOfWeek: Record<string, number>;
  postsBySource?: Record<string, number>;
  totalPublishedPosts: number;
  bestObservedHour: string;
  bestObservedDay: string;
  successfulPostsCount: number;
  /** Publicaciones exitosas con hora confirmada por la API. */
  publicationsWithPublishedAtCount: number;
  failedPostsCount: number;
  successRatePercentage: number | null;
  recordedTokens: number;
  tokensByModel: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  usageEvents: number;
  /** Tokens de texto reportados por fecha local del espacio (YYYY-MM-DD). */
  tokensByDay?: Record<string, number>;
}

@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/schedules`;

  getSchedules(): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(this.apiUrl);
  }

  getPostingDistribution(days?: number | null): Observable<PostingDistribution> {
    const params = days == null ? undefined : { days: `${days}` };
    return this.http.get<PostingDistribution>(`${this.apiUrl}/distribution`, { params });
  }

  createSchedule(cronExpression: string, description: string): Observable<Schedule> {
    return this.http.post<Schedule>(this.apiUrl, { cronExpression, description });
  }

  updateSchedule(id: string, cronExpression: string, description: string): Observable<Schedule> {
    return this.http.put<Schedule>(`${this.apiUrl}/${id}`, { cronExpression, description });
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  triggerSchedule(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/trigger`, {});
  }
}
