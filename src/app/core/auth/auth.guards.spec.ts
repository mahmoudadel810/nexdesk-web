import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { authResponse } from './auth-testing';
import { authGuard, guestGuard, permissionGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function run(guard: CanActivateFn, url = '/app/tickets'): string | boolean {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  function signIn(): void {
    TestBed.inject(AuthService).login('olivia@example.test', 'Passw0rd-123').subscribe();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/login').flush(authResponse());
  }

  it('sends anonymous visitors to the login page and remembers where they were going', () => {
    expect(run(authGuard)).toBe('/auth/login?returnUrl=%2Fapp%2Ftickets');
  });

  it('lets signed-in users into the app and keeps them out of the sign-in pages', () => {
    signIn();

    expect(run(authGuard)).toBe(true);
    expect(run(guestGuard)).toBe('/app');
  });

  it('lets anonymous visitors open the sign-in pages', () => {
    expect(run(guestGuard)).toBe(true);
  });

  it('checks the permission list of the session', () => {
    signIn();

    expect(run(permissionGuard('users.manage'))).toBe(true);
    expect(run(permissionGuard('billing.manage'))).toBe('/app');
  });

  it('only returns to paths inside the app', () => {
    expect(safeReturnUrl('/app/tickets/42')).toBe('/app/tickets/42');
    expect(safeReturnUrl('https://evil.example')).toBe('/app');
    expect(safeReturnUrl('//evil.example')).toBe('/app');
    expect(safeReturnUrl('/auth/login')).toBe('/app');
    expect(safeReturnUrl(undefined)).toBe('/app');
  });
});
