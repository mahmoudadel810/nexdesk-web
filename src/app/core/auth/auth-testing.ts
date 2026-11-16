import { AuthResponse, Session } from './auth.models';

export const TEST_SESSION: Session = {
  user: {
    id: 'user-1',
    email: 'olivia@example.test',
    fullName: 'Olivia Owner',
    role: 'Owner',
    language: 'en',
    isPlatformAdmin: false,
  },
  tenant: {
    id: 'tenant-1',
    name: 'Acme Support',
    slug: 'acme-support',
    defaultLanguage: 'en',
    timezone: 'UTC',
  },
  permissions: ['tickets.view', 'users.manage'],
};

export function authResponse(accessToken = 'token-1'): AuthResponse {
  return { accessToken, expiresAt: '2030-01-01T00:00:00Z', session: TEST_SESSION };
}
