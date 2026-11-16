import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/app']) : true;

/** Sends workspace admins to the setup wizard until they have finished it. */
export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const tenant = auth.session()?.tenant;
  return tenant && !tenant.onboardingCompleted && auth.can('settings.manage')
    ? inject(Router).createUrlTree(['/onboarding'])
    : true;
};

export function permissionGuard(permission: string): CanActivateFn {
  return () =>
    inject(AuthService).can(permission) ? true : inject(Router).createUrlTree(['/app']);
}

/** Accepts only in-app paths, so a crafted link cannot send the user to another site after sign-in. */
export function safeReturnUrl(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/auth')
    ? value
    : '/app';
}
