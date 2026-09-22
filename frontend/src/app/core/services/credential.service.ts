import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectLinkedInAccountRequest, GitHubRepo, GitHubStatus, LinkedInAccount, LinkedInStatus } from '../models/credential.model';

@Injectable({
  providedIn: 'root'
})
export class CredentialService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // --- LINKEDIN MULTI-ACCOUNT ---

  getLinkedInAccounts(): Observable<LinkedInAccount[]> {
    return this.http.get<LinkedInAccount[]>(`${this.API_URL}/credentials/linkedin/accounts`);
  }

  connectLinkedInAccount(req: ConnectLinkedInAccountRequest): Observable<LinkedInAccount> {
    return this.http.post<LinkedInAccount>(`${this.API_URL}/credentials/linkedin/accounts`, req);
  }

  toggleLinkedInAccount(id: string): Observable<LinkedInAccount> {
    return this.http.patch<LinkedInAccount>(`${this.API_URL}/credentials/linkedin/accounts/${id}/toggle`, {});
  }

  setPrimaryLinkedInAccount(id: string): Observable<LinkedInAccount> {
    return this.http.patch<LinkedInAccount>(`${this.API_URL}/credentials/linkedin/accounts/${id}/set-primary`, {});
  }

  updateAccountLimit(id: string, maxPostsPerDay: number): Observable<LinkedInAccount> {
    return this.http.patch<LinkedInAccount>(`${this.API_URL}/credentials/linkedin/accounts/${id}/limit`, { maxPostsPerDay });
  }

  resetTodayQuota(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.API_URL}/credentials/linkedin/accounts/${id}/reset-today-count`, {});
  }

  deleteLinkedInAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/credentials/linkedin/accounts/${id}`);
  }

  // --- LEGACY LINKEDIN COMPATIBILITY ---

  getLinkedInStatus(): Observable<LinkedInStatus> {
    return this.http.get<LinkedInStatus>(`${this.API_URL}/credentials/linkedin/status`);
  }

  saveLinkedInCredential(accessToken: string, personUrn?: string, expiresInDays?: number): Observable<any> {
    return this.http.post(`${this.API_URL}/credentials/linkedin`, { accessToken, personUrn, expiresInDays });
  }

  updateLinkedInCredential(accessToken: string, personUrn?: string, expiresInDays?: number): Observable<any> {
    return this.http.put(`${this.API_URL}/credentials/linkedin`, { accessToken, personUrn, expiresInDays });
  }

  deleteLinkedInCredential(): Observable<any> {
    return this.http.delete(`${this.API_URL}/credentials/linkedin`);
  }


  // --- GITHUB ---

  getGitHubStatus(): Observable<GitHubStatus> {
    return this.http.get<GitHubStatus>(`${this.API_URL}/credentials/github/status`);
  }

  saveGitHubCredential(personalAccessToken: string, githubUsername: string): Observable<any> {
    return this.http.post(`${this.API_URL}/credentials/github`, { personalAccessToken, githubUsername });
  }

  updateGitHubCredential(personalAccessToken: string, githubUsername: string): Observable<any> {
    return this.http.put(`${this.API_URL}/credentials/github`, { personalAccessToken, githubUsername });
  }

  deleteGitHubCredential(): Observable<any> {
    return this.http.delete(`${this.API_URL}/credentials/github`);
  }

  // --- MONITORED REPOS ---

  getMonitoredRepos(): Observable<GitHubRepo[]> {
    return this.http.get<GitHubRepo[]>(`${this.API_URL}/github/repos`);
  }

  addMonitoredRepo(repoOwner: string, repoName: string): Observable<GitHubRepo> {
    return this.http.post<GitHubRepo>(`${this.API_URL}/github/repos`, { repoOwner, repoName });
  }

  updateMonitoredRepo(id: string, repoOwner: string, repoName: string): Observable<GitHubRepo> {
    return this.http.put<GitHubRepo>(`${this.API_URL}/github/repos/${id}`, { repoOwner, repoName });
  }

  deleteMonitoredRepo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/github/repos/${id}`);
  }
}
