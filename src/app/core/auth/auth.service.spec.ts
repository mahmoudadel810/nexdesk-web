import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authResponse } from './auth-testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.session()).toBeNull();
    expect(auth.can('tickets.view')).toBe(false);
  });

  it('stores the session and permissions after login', () => {
    auth.login('olivia@example.test', 'Passw0rd-123').subscribe();

    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({
      email: 'olivia@example.test',
      password: 'Passw0rd-123',
    });
    request.flush(authResponse());

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('token-1');
    expect(auth.can('users.manage')).toBe(true);
    expect(auth.can('billing.manage')).toBe(false);
  });

  it('shares one refresh request between concurrent callers', () => {
    const tokens: string[] = [];
    auth.refresh().subscribe((token) => tokens.push(token));
    auth.refresh().subscribe((token) => tokens.push(token));

    http.expectOne('/api/v1/auth/refresh').flush(authResponse('token-2'));

    expect(tokens).toEqual(['token-2', 'token-2']);
    expect(auth.accessToken()).toBe('token-2');
  });

  it('starts a new refresh once the previous one has finished', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/v1/auth/refresh').flush(authResponse('token-2'));

    auth.refresh().subscribe();
    http.expectOne('/api/v1/auth/refresh').flush(authResponse('token-3'));

    expect(auth.accessToken()).toBe('token-3');
  });

  it('does not call the API on load when this browser never signed in', async () => {
    await auth.restore();

    http.expectNone('/api/v1/auth/refresh');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('restores the session on load after an earlier sign-in', async () => {
    localStorage.setItem('nexdesk.session', '1');

    const restoring = auth.restore();
    http.expectOne('/api/v1/auth/refresh').flush(authResponse());
    await restoring;

    expect(auth.isAuthenticated()).toBe(true);
  });

  it('forgets the sign-in hint when the refresh cookie is no longer valid', async () => {
    localStorage.setItem('nexdesk.session', '1');

    const restoring = auth.restore();
    http
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'invalid-refresh-token' }, { status: 401, statusText: 'Unauthorized' });
    await restoring;

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('nexdesk.session')).toBeNull();
  });

  it('clears the session on logout even when the request fails', () => {
    auth.login('olivia@example.test', 'Passw0rd-123').subscribe();
    http.expectOne('/api/v1/auth/login').flush(authResponse());

    auth.logout().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/logout').error(new ProgressEvent('error'));

    expect(auth.isAuthenticated()).toBe(false);
  });

  it('remembers the address that still needs confirming after registration', () => {
    auth
      .register({
        workspaceName: 'Acme',
        fullName: 'Olivia',
        email: 'olivia@example.test',
        password: 'Passw0rd-123',
        language: 'en',
        timezone: 'UTC',
      })
      .subscribe();
    http
      .expectOne('/api/v1/auth/register')
      .flush({ tenantId: 't', slug: 'acme', email: 'olivia@example.test' });

    expect(auth.pendingVerificationEmail()).toBe('olivia@example.test');
    expect(auth.isAuthenticated()).toBe(false);
  });
});
