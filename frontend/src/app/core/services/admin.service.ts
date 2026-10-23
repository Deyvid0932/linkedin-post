import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalWorkspaces: number;
  publishedPosts: number;
  failedPosts: number;
  periodDays: number;
  apiRequestMetricsStartedOn: string | null;
  apiRequestsToday: number;
  successfulApiRequestsToday: number;
  redirectedApiRequestsToday: number;
  clientErrorApiRequestsToday: number;
  serverErrorApiRequestsToday: number;
  dailyApiRequests: AdminDailyApiRequestCount[];
  recordedTokensInPeriod: number;
  textMetricsStartedOn: string | null;
  reportedTextRequestsInPeriod: number;
  successfulImageGenerationsInPeriod: number;
  imageMetricsStartedOn: string | null;
  http429ResponsesInPeriod: number;
  http429MetricsStartedOn: string | null;
  http429ResponsesByRouteGroupInPeriod: Record<'auth' | 'ai' | 'api', number>;
  dailyHttp429Responses: AdminDailyHttp429Count[];
  dailyReportedTextTokens?: AdminDailyTextUsage[];
  dailyImageGenerations?: AdminDailyImageGeneration[];
  textUsageByModel?: AdminModelTextUsage[];
  dailyPublicationOutcomes?: AdminDailyPublicationOutcome[];
}

export interface AdminDailyTextUsage {
  date: string;
  tracked: boolean;
  tokens: number;
}

export interface AdminDailyImageGeneration {
  date: string;
  tracked: boolean;
  successfulGenerations: number;
}

export interface AdminDailyApiRequestCount {
  date: string;
  tracked: boolean;
  successful: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
}

export interface AdminDailyPublicationOutcome {
  date: string;
  published: number;
  failed: number;
}

export interface AdminDailyHttp429Count {
  date: string;
  tracked: boolean;
  auth: number;
  ai: number;
  api: number;
}

export interface AdminModelTextUsage {
  provider: string;
  model: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AdminUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
  createdAt: string;
  aiRequestsPerMinute: number | null;
  aiRequestsPerMinuteExpiresAt: string | null;
  effectiveAiRequestsPerMinute: number;
}

export interface AdminUserPage {
  content: AdminUser[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AccountInvitation {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  status: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';
}

export interface AccountInvitationPage {
  content: AccountInvitation[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CreatedAccountInvitation {
  id: string;
  email: string;
  invitationUrl: string;
  expiresAt: string;
}

export interface AdminAuditEvent {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  createdAt: string;
}

export interface AdminAuditPage {
  content: AdminAuditEvent[];
  number: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiQuotaPolicy {
  authRequestsPerMinute: number;
  aiRequestsPerMinute: number;
  apiRequestsPerMinute: number;
  updatedAt: string;
}

export interface PublicationApprovalPolicy {
  approvalRequired: boolean;
  updatedAt: string;
}

export interface TenantAiQuota {
  tenantId: string;
  primaryEmail: string | null;
  accountCount: number;
  overrideRequestsPerMinute: number | null;
  overrideExpiresAt: string | null;
  effectiveRequestsPerMinute: number;
}

export interface TenantAiQuotaPage {
  content: TenantAiQuota[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type ApiQuotaPolicyUpdate = Omit<ApiQuotaPolicy, 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/admin`;

  getOverview(periodDays = 30): Observable<AdminOverview> {
    const params = new HttpParams().set('periodDays', `${periodDays}`);
    return this.http.get<AdminOverview>(`${this.baseUrl}/overview`, { params });
  }

  getUsers(search: string, page: number, size = 20): Observable<AdminUserPage> {
    const params = new HttpParams()
      .set('search', search)
      .set('page', `${page}`)
      .set('size', `${size}`);
    return this.http.get<AdminUserPage>(`${this.baseUrl}/users`, { params });
  }

  getAuditEvents(page = 0, size = 20): Observable<AdminAuditPage> {
    const params = new HttpParams().set('page', `${page}`).set('size', `${size}`);
    return this.http.get<AdminAuditPage>(`${this.baseUrl}/audit-events`, { params });
  }

  setUserActive(userId: string, active: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/users/${userId}/status`, { active });
  }

  setUserRoles(userId: string, roles: string[]): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.baseUrl}/users/${userId}/roles`, { roles });
  }

  updateUserAiQuota(userId: string, requestsPerMinute: number | null, expiresAt: string | null): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${this.baseUrl}/users/${userId}/ai-quota`, { requestsPerMinute, expiresAt });
  }

  getInvitations(page = 0, size = 20): Observable<AccountInvitationPage> {
    const params = new HttpParams().set('page', `${page}`).set('size', `${size}`);
    return this.http.get<AccountInvitationPage>(`${this.baseUrl}/invitations`, { params });
  }

  createInvitation(email: string): Observable<CreatedAccountInvitation> {
    return this.http.post<CreatedAccountInvitation>(`${this.baseUrl}/invitations`, { email });
  }

  revokeInvitation(invitationId: string): Observable<AccountInvitation> {
    return this.http.delete<AccountInvitation>(`${this.baseUrl}/invitations/${invitationId}`);
  }

  getApiQuotaPolicy(): Observable<ApiQuotaPolicy> {
    return this.http.get<ApiQuotaPolicy>(`${this.baseUrl}/api-quotas`);
  }

  updateApiQuotaPolicy(policy: ApiQuotaPolicyUpdate): Observable<ApiQuotaPolicy> {
    return this.http.put<ApiQuotaPolicy>(`${this.baseUrl}/api-quotas`, policy);
  }

  getPublicationApprovalPolicy(): Observable<PublicationApprovalPolicy> {
    return this.http.get<PublicationApprovalPolicy>(`${this.baseUrl}/publication-policy`);
  }

  updatePublicationApprovalPolicy(approvalRequired: boolean): Observable<PublicationApprovalPolicy> {
    return this.http.put<PublicationApprovalPolicy>(`${this.baseUrl}/publication-policy`, { approvalRequired });
  }

  getTenantAiQuotas(page = 0, size = 20): Observable<TenantAiQuotaPage> {
    const params = new HttpParams().set('page', `${page}`).set('size', `${size}`);
    return this.http.get<TenantAiQuotaPage>(`${this.baseUrl}/tenant-ai-quotas`, { params });
  }

  updateTenantAiQuota(tenantId: string, requestsPerMinute: number | null, expiresAt: string | null): Observable<TenantAiQuota> {
    return this.http.put<TenantAiQuota>(`${this.baseUrl}/tenant-ai-quotas/${tenantId}`, { requestsPerMinute, expiresAt });
  }
}
