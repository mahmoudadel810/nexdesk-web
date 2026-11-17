import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authResponse } from '../core/auth/auth-testing';
import { AuthService } from '../core/auth/auth.service';
import { authInterceptor } from '../core/http/interceptors';
import { PortalService } from './portal.service';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('PortalService', () => {
  let portal: PortalService;
  let http: HttpClient;
  let backend: HttpTestingController;
  let navigations: unknown[][];

  const customer = { id: 'c1', email: 'casey@example.test', fullName: 'Casey Customer' };
  const portalAuth = (token: string) => ({
    accessToken: token,
    expiresAt: '2030-01-01T00:00:00Z',
    customer,
  });

  beforeEach(() => {
    localStorage.clear();
    navigations = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            url: '/portal/acme/tickets',
            navigate: (...args: unknown[]) => {
              navigations.push(args);
              return Promise.resolve(true);
            },
          },
        },
      ],
    });
    portal = TestBed.inject(PortalService);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function signInCustomer(): void {
    portal.login('acme', customer.email, 'Passw0rd-123').subscribe();
    backend.expectOne('/api/v1/portal/acme/auth/login').flush(portalAuth('customer-token'));
  }

  it('keeps the customer session separate from the staff session', () => {
    TestBed.inject(AuthService).login('agent@example.test', 'Passw0rd-123').subscribe();
    backend.expectOne('/api/v1/auth/login').flush(authResponse('staff-token'));
    signInCustomer();

    http.get('/api/v1/portal/acme/tickets').subscribe();
    http.get('/api/v1/tickets').subscribe();

    expect(
      backend.expectOne('/api/v1/portal/acme/tickets').request.headers.get('Authorization'),
    ).toBe('Bearer customer-token');
    expect(backend.expectOne('/api/v1/tickets').request.headers.get('Authorization')).toBe(
      'Bearer staff-token',
    );
    expect(portal.customer()).toEqual(customer);
  });

  it('never sends the customer token of one workspace to another', () => {
    signInCustomer();

    http.get('/api/v1/portal/other-co/tickets').subscribe({ error: () => undefined });

    const request = backend.expectOne('/api/v1/portal/other-co/tickets');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, { status: 404, statusText: 'Not Found' });
  });

  it('refreshes the customer session on a 401 and replays the request', async () => {
    signInCustomer();
    let result: unknown;

    http.get('/api/v1/portal/acme/tickets').subscribe((value) => (result = value));
    backend
      .expectOne('/api/v1/portal/acme/tickets')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/portal/acme/auth/refresh').flush(portalAuth('fresh-token'));
    await settle();

    const retried = backend.expectOne('/api/v1/portal/acme/tickets');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retried.flush({ items: [] });
    expect(result).toEqual({ items: [] });
  });

  it('returns to the help centre login when the customer session cannot be refreshed', async () => {
    signInCustomer();

    http.get('/api/v1/portal/acme/tickets').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/v1/portal/acme/tickets')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/portal/acme/auth/refresh')
      .flush({ code: 'invalid-refresh-token' }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(portal.isAuthenticated()).toBe(false);
    expect(navigations).toEqual([[['/portal', 'acme', 'login']]]);
  });

  it('restores a session only for a workspace this browser signed in to', async () => {
    await portal.restore('acme');
    backend.expectNone('/api/v1/portal/acme/auth/refresh');

    localStorage.setItem('nexdesk.portal.acme', '1');
    const restoring = portal.restore('acme');
    backend.expectOne('/api/v1/portal/acme/auth/refresh').flush(portalAuth('restored'));
    await restoring;

    expect(portal.isAuthenticated()).toBe(true);
    expect(portal.tokenFor('/api/v1/portal/acme/tickets')).toBe('restored');
    expect(portal.tokenFor('/api/v1/portal/acme-two/tickets')).toBeNull();
  });
});
