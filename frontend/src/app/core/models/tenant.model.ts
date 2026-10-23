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
  appTextModel?: 'deepseek-flash' | 'deepseek-v4-pro';
  platformApprovalRequired?: boolean;
}

export interface TenantProfileRequest {
  systemPrompt?: string;
  timezone?: string;
  appApprovalMode?: 'REQUIRE_APPROVAL' | 'AUTOMATIC';
  appTargetCharacters?: number;
  appImageModel?: string;
  appTextModel?: 'deepseek-flash' | 'deepseek-v4-pro';
}

export interface DashboardStats {
  totalPublications: number;
  successCount: number;
  failedCount: number;
  activeSchedules: number;
  linkedInConnected: boolean;
  linkedInDaysRemaining: number;
}

export type AccentColor = 'red' | 'blue' | 'green' | 'yellow';

export interface AppearanceSettings {
  userAccentColor: AccentColor;
  defaultAccentColor: AccentColor;
  allowedAccentColors: AccentColor[];
  administrator: boolean;
}

export interface TenantAppearancePolicyRequest {
  defaultAccentColor: AccentColor;
  allowedAccentColors: AccentColor[];
}
