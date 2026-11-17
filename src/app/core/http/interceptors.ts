import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PortalService } from '../../portal/portal.service';
import { AuthService } from '../auth/auth.service';
import { Notifier } from '../ui/notifier';
import { LoadingService } from './loading.service';
import { SKIP_AUTH, SKIP_ERROR_TOAST, toProblem } from './problem';

const PORTAL_URL = new RegExp(`^${environment.apiUrl}/portal/([^/]+)`);

export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  const loading = inject(LoadingService);
  loading.begin();
  return next(request).pipe(finalize(() => loading.end()));
};

/** Adds the bearer token and, on a 401, refreshes the session once and replays the request. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_AUTH) || !request.url.startsWith(environment.apiUrl)) {
    return next(request);
  }

  const router = inject(Router);
  const portalSlug = PORTAL_URL.exec(request.url)?.[1];
  if (portalSlug) {
    // Help-centre requests carry the customer's token, never the agent's.
    const portal = inject(PortalService);
    return next(withToken(request, portal.tokenFor(request.url))).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          return throwError(() => error);
        }

        return portal.refresh().pipe(
          catchError((refreshError: unknown) => {
            portal.clear();
            void router.navigate(['/portal', decodeURIComponent(portalSlug), 'login']);
            return throwError(() => refreshError);
          }),
          switchMap((token) => next(withToken(request, token))),
        );
      }),
    );
  }

  const auth = inject(AuthService);

  return next(withToken(request, auth.accessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          auth.clear();
          void router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withToken(request, token))),
      );
    }),
  );
};

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifier = inject(Notifier);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!request.context.get(SKIP_ERROR_TOAST)) {
        notifier.problem(toProblem(error));
      }

      return throwError(() => error);
    }),
  );
};

function withToken<T>(request: HttpRequest<T>, token: string | null): HttpRequest<T> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
