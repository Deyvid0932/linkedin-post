import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DailyContentSuggestion {
  title: string;
  text: string;
  rationale: string;
  basedOnPublications: number;
  bestObservedDay: string;
  bestObservedHour: string;
  generatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DailySuggestionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/insights/daily-suggestion`;

  generate() {
    return this.http.post<DailyContentSuggestion>(this.url, {});
  }
}
