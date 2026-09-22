export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  roles: string[];
}

export interface UserProfile {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  roles: string[];
}
