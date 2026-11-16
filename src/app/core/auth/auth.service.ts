import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { readStored, removeStored, writeStored } from '../browser-storage';
import { SKIP_AUTH, SKIP_ERROR_TOAST } from '../http/problem';
import { AuthResponse, RegisterResult, RegisterWorkspace, Session } from './auth.models';

const SESSION_HINT_KEY = 'nexdesk.session';
const AUTH_URL = `${environment.apiUrl}/auth`;

interface AuthState {
  readonly accessToken: string;
  readonly session: Session;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<AuthState | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly session = computed(() => this.state()?.session ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly accessToken = computed(() => this.state()?.accessToken ?? null);
  private readonly permissions = computed(() => new Set(this.session()?.permissions ?? []));

  /** Address of a just-registered account that still has to confirm its email. */
  readonly pendingVerificationEmail = signal<string | null>(null);

  can(permission: string): boolean {
    return this.permissions().has(permission);
  }

  login(email: string, password: string): Observable<Session> {
    return this.http
      .post<AuthResponse>(`${AUTH_URL}/login`, { email, password }, { context: selfHandled() })
      .pipe(map((response) => this.accept(response)));
  }

  register(registration: RegisterWorkspace): Observable<RegisterResult> {
    return this.http
      .post<RegisterResult>(`${AUTH_URL}/register`, registration, { context: selfHandled() })
      .pipe(tap((result) => this.pendingVerificationEmail.set(result.email)));
  }

  verifyEmail(token: string): Observable<Session> {
    return this.http
      .post<AuthResponse>(`${AUTH_URL}/verify-email`, { token }, { context: selfHandled() })
      .pipe(
        map((response) => this.accept(response)),
        tap(() => this.pendingVerificationEmail.set(null)),
      );
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(
      `${AUTH_URL}/resend-verification`,
      { email },
      { context: selfHandled() },
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(
      `${AUTH_URL}/forgot-password`,
      { email },
      { context: selfHandled() },
    );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${AUTH_URL}/reset-password`,
      { token, newPassword },
      { context: selfHandled() },
    );
  }

  /** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.http
      .post<AuthResponse>(`${AUTH_URL}/refresh`, null, { context: selfHandled() })
      .pipe(
        map((response) => {
          this.accept(response);
          return response.accessToken;
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  /** Restores the session on page load when this browser signed in before. */
  async restore(): Promise<void> {
    if (readStored(SESSION_HINT_KEY) === null) {
      return;
    }

    try {
      await firstValueFrom(
        this.http
          .post<AuthResponse>(`${AUTH_URL}/refresh`, null, { context: selfHandled() })
          .pipe(map((response) => this.accept(response))),
      );
    } catch {
      this.clear();
    }
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${AUTH_URL}/logout`, null, { context: selfHandled() })
      .pipe(finalize(() => this.clear()));
  }

  acceptInvitation(token: string, fullName: string, password: string): Observable<Session> {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/invitations/accept`,
        { token, fullName, password },
        { context: selfHandled() },
      )
      .pipe(map((response) => this.accept(response)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<Session> {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/users/me/change-password`,
        { currentPassword, newPassword },
        { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
      )
      .pipe(map((response) => this.accept(response)));
  }

  /** Replaces the cached session after the profile or workspace changed. */
  updateSession(session: Session): void {
    this.state.update((state) => (state ? { ...state, session } : state));
  }

  clear(): void {
    this.state.set(null);
    removeStored(SESSION_HINT_KEY);
  }

  private accept(response: AuthResponse): Session {
    this.state.set({ accessToken: response.accessToken, session: response.session });
    writeStored(SESSION_HINT_KEY, '1');
    return response.session;
  }
}

function selfHandled(): HttpContext {
  return new HttpContext().set(SKIP_AUTH, true).set(SKIP_ERROR_TOAST, true);
}
