export type LinkedInAccountType = 'PERSON' | 'ORGANIZATION';

export interface LinkedInAccount {
  id: string;
  accountType: LinkedInAccountType;
  authorUrn: string;
  displayName: string;
  vanityName?: string | null;
  maxPostsPerDay?: number;
  isEnabled: boolean;
  isPrimary: boolean;
  isValid: boolean;
  tokenExpiresAt?: string;
  daysRemaining: number;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_CONFIGURED';
  createdAt: string;
}

export interface LinkedInStatus {
  connected: boolean;
  personUrn?: string;
  expiresAt?: string;
  daysRemaining?: number;
  status: 'ACTIVE' | 'EXPIRED' | 'NOT_CONFIGURED';
}

export interface ConnectLinkedInAccountRequest {
  accessToken?: string;
  useExistingTokenFromAccountId?: string;
  accountType: LinkedInAccountType;
  authorUrn?: string;
  displayName?: string;
  vanityName?: string;
  expiresInDays?: number;
  maxPostsPerDay?: number;
}


export interface GitHubStatus {
  connected: boolean;
  username: string;
}

export interface GitHubRepo {
  id: string;
  repoOwner: string;
  repoName: string;
  lastCheckedAt?: string;
  lastCommitSha?: string;
  isActive: boolean;
  createdAt: string;
}
