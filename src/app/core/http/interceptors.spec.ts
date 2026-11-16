import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authResponse } from '../auth/auth-testing';
import { AuthService } from '../auth/auth.service';
import { Notifier } from '../ui/notifier';
import { authInterceptor, errorInterceptor, loadingInterceptor } from './interceptors';
import { LoadingService } from './loading.service';
import { Problem, SKIP_ERROR_TOAST } from './problem';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let problems: Problem[];
  let navigations: unknown[][];

  beforeEach(() => {
    localStorage.clear();
    problems = [];
    navigations = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([loadingInterceptor, errorInterceptor, authInterceptor]),
        ),
        provideHttpClientTesting(),
        { provide: Notifier, useValue: { problem: (problem: Problem) => problems.push(problem) } },
        {
          provide: Router,
          useValue: {
            url: '/app/tickets',
            navigate: (...args: unknown[]) => {
              navigations.push(args);
              return Promise.resolve(true);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  function signIn(): void {
    auth.login('olivia@example.test', 'Passw0rd-123').subscribe();
    backend.expectOne('/api/v1/auth/login').flush(authResponse('token-1'));
  }

  it('adds the bearer token to API requests only', () => {
    signIn();

    http.get('/api/v1/tickets').subscribe();
    http.get('/i18n/en.json').subscribe();

    expect(backend.expectOne('/api/v1/tickets').request.headers.get('Authorization')).toBe(
      'Bearer token-1',
    );
    expect(backend.expectOne('/i18n/en.json').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes once and replays every request that got a 401', async () => {
    signIn();
    const results: unknown[] = [];

    http.get('/api/v1/tickets').subscribe((value) => results.push(value));
    http.get('/api/v1/teams').subscribe((value) => results.push(value));
    backend.expectOne('/api/v1/tickets').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/teams').flush(null, { status: 401, statusText: 'Unauthorized' });

    backend.expectOne('/api/v1/auth/refresh').flush(authResponse('token-2'));
    await settle();

    const tickets = backend.expectOne('/api/v1/tickets');
    const teams = backend.expectOne('/api/v1/teams');
    expect(tickets.request.headers.get('Authorization')).toBe('Bearer token-2');
    expect(teams.request.headers.get('Authorization')).toBe('Bearer token-2');
    tickets.flush(['ticket']);
    teams.flush(['team']);

    expect(results).toEqual([['ticket'], ['team']]);
    expect(problems).toEqual([]);
  });

  it('signs out and returns to the login page when the refresh fails', async () => {
    signIn();
    let failed = false;

    http.get('/api/v1/tickets').subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/v1/tickets').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'invalid-refresh-token' }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigations).toEqual([
      [['/auth/login'], { queryParams: { returnUrl: '/app/tickets' } }],
    ]);
    expect(problems.map((problem) => problem.code)).toEqual(['invalid-refresh-token']);
  });

  it('reports failures as a toast unless the caller handles them', () => {
    signIn();

    http.get('/api/v1/tickets').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/v1/tickets')
      .flush({ code: 'forbidden' }, { status: 403, statusText: 'Forbidden' });
    http
      .get('/api/v1/teams', { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
      .subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/teams').flush(null, { status: 500, statusText: 'Server Error' });

    expect(problems).toEqual([
      { status: 403, code: 'forbidden', title: undefined, errors: undefined },
    ]);
  });

  it('tracks requests in flight for the progress bar', () => {
    const loading = TestBed.inject(LoadingService);

    http.get('/api/v1/meta').subscribe();
    expect(loading.isLoading()).toBe(true);

    backend.expectOne('/api/v1/meta').flush({});
    expect(loading.isLoading()).toBe(false);
  });
});
