export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: 'Owner' | 'Admin' | 'Agent' | 'Viewer' | null;
  readonly language: string;
  readonly isPlatformAdmin: boolean;
}

export interface SessionTenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly defaultLanguage: string;
  readonly timezone: string;
}

export interface Session {
  readonly user: SessionUser;
  readonly tenant: SessionTenant | null;
  readonly permissions: readonly string[];
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly session: Session;
}

export interface RegisterWorkspace {
  readonly workspaceName: string;
  readonly fullName: string;
  readonly email: string;
  readonly password: string;
  readonly language: string;
  readonly timezone: string;
}

export interface RegisterResult {
  readonly tenantId: string;
  readonly slug: string;
  readonly email: string;
}
