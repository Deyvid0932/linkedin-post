export interface TenantResponse {
  id: string;
  systemPrompt: string | null;
  timezone: string;
  isActive: boolean;
  isEmergencyPaused?: boolean;
  isDryRun?: boolean;
  createdAt: string;
  appApprovalMode?: 'REQUIRE_APPROVAL' | 'AUTOMATIC';
  appTargetCharacters?: number;
  appImageModel?: string;
}

export interface TenantProfileRequest {
  systemPrompt?: string;
  timezone?: string;
  appApprovalMode?: 'REQUIRE_APPROVAL' | 'AUTOMATIC';
  appTargetCharacters?: number;
  appImageModel?: string;
}

export interface DashboardStats {
  totalPublications: number;
  successCount: number;
  failedCount: number;
  activeSchedules: number;
  linkedInConnected: boolean;
  linkedInDaysRemaining: number;
}
