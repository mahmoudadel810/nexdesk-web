import { HttpContextToken, HttpErrorResponse } from '@angular/common/http';

/** RFC 7807 problem document as the API returns it. */
export interface Problem {
  readonly status: number;
  readonly code: string;
  readonly title?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

/** Set on requests whose caller shows the failure itself, so no toast is raised. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Set on requests that must not carry a bearer token or trigger a silent refresh. */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export function toProblem(error: unknown): Problem {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return { status: 0, code: 'network' };
    }

    const body: unknown = error.error;
    if (isRecord(body)) {
      return {
        status: error.status,
        code: typeof body['code'] === 'string' ? body['code'] : fallbackCode(error.status),
        title: typeof body['title'] === 'string' ? body['title'] : undefined,
        errors: isRecord(body['errors'])
          ? (body['errors'] as Record<string, readonly string[]>)
          : undefined,
      };
    }

    return { status: error.status, code: fallbackCode(error.status) };
  }

  return { status: 0, code: 'generic' };
}

function fallbackCode(status: number): string {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 429:
      return 'too-many-requests';
    default:
      return 'generic';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
