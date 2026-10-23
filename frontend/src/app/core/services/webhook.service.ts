import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type WebhookEventName = 'post.published' | 'post.delivery_unknown';

export interface WebhookEndpoint {
  id: string;
  name: string;
  targetHost: string;
  events: string[];
  active: boolean;
  secretConfigured: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  endpointName: string;
  eventId: string;
  eventType: string;
  status: 'PENDING' | 'SENDING' | 'DELIVERED' | 'FAILED';
  attemptCount: number;
  httpStatus: number | null;
  responseSummary: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface WebhookPage {
  content: WebhookDelivery[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface WebhookCreated {
  endpoint: WebhookEndpoint;
  secret: string;
}

@Injectable({ providedIn: 'root' })
export class WebhookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/webhooks`;

  listEndpoints(): Observable<WebhookEndpoint[]> {
    return this.http.get<WebhookEndpoint[]>(this.baseUrl);
  }

  create(name: string, targetUrl: string, events: WebhookEventName[]): Observable<WebhookCreated> {
    return this.http.post<WebhookCreated>(this.baseUrl, { name, targetUrl, events });
  }

  setActive(id: string, active: boolean): Observable<WebhookEndpoint> {
    return this.http.patch<WebhookEndpoint>(`${this.baseUrl}/${id}/active`, { active });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  sendTest(id: string): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${this.baseUrl}/${id}/test`, {});
  }

  listDeliveries(page = 0, size = 20): Observable<WebhookPage> {
    const params = new HttpParams().set('page', `${page}`).set('size', `${size}`);
    return this.http.get<WebhookPage>(`${this.baseUrl}/deliveries`, { params });
  }

  retry(deliveryId: string): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${this.baseUrl}/deliveries/${deliveryId}/retry`, {});
  }
}
