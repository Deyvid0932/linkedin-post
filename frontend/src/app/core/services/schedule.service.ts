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

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/schedules`;

  getSchedules(): Observable<Schedule[]> {
    return this.http.get<Schedule[]>(this.apiUrl);
  }

  createSchedule(cronExpression: string, description: string): Observable<Schedule> {
    return this.http.post<Schedule>(this.apiUrl, { cronExpression, description });
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  triggerSchedule(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/trigger`, {});
  }
}
