import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, defer, finalize, firstValueFrom, map, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { Attachment, TicketStatus } from '../core/api/tickets.api';
import { Paged } from '../core/api/workspace.api';
import { readStored, removeStored, writeStored } from '../core/browser-storage';
import { SKIP_AUTH, SKIP_ERROR_TOAST } from '../core/http/problem';

export interface PortalInfo {
  readonly name: string;
  readonly slug: string;
  readonly defaultLanguage: string;
}

export interface PortalCustomer {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
}

interface PortalAuthResponse {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly customer: PortalCustomer;
}

export interface PortalTicketListItem {
  readonly id: string;
  readonly number: number;
  readonly subject: string;
  readonly status: TicketStatus;
  readonly createdAt: string;
  readonly lastActivityAt: string;
}

export interface PortalMessage {
  readonly id: string;
  readonly fromSupport: boolean;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly attachments: readonly Attachment[];
}

export interface Csat {
  readonly rating: number;
  readonly comment: string | null;
}

export interface PortalTicket {
  readonly id: string;
  readonly number: number;
  readonly subject: string;
  readonly status: TicketStatus;
  readonly createdAt: string;
  readonly messages: readonly PortalMessage[];
  readonly canReply: boolean;
  readonly canRate: boolean;
  readonly csat: Csat | null;
}

export interface CsatSurvey {
  readonly ticketNumber: number;
  readonly ticketSubject: string;
  readonly csat: Csat | null;
}

export interface HelpCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly articleCount: number;
}

export interface HelpArticleSummary {
  readonly title: string;
  readonly slug: string;
  readonly categoryName: string;
  readonly excerpt: string;
}

export interface HelpArticle {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly categoryName: string;
  readonly bodyHtml: string;
  readonly publishedAt: string | null;
  readonly updatedAt: string | null;
}

interface PortalState {
  readonly slug: string;
  readonly accessToken: string;
  readonly customer: PortalCustomer;
}

/** Requests that sign the customer in or out, or that anyone may call: no bearer token, errors shown inline. */
function open(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_ERROR_TOAST, true) };
}

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

/**
 * Session and API of the customer help centre. It is separate from the staff session: a person can be
 * signed in to a workspace's help centre as a customer and to NexDesk as an agent at the same time.
 */
@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<PortalState | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly info = signal<PortalInfo | null>(null);
  readonly customer = computed(() => this.state()?.customer ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);

  url(slug: string, path = ''): string {
    return `${environment.apiUrl}/portal/${encodeURIComponent(slug)}${path}`;
  }

  /** The token to send for a portal URL, or null when the customer is not signed in to that workspace. */
  tokenFor(url: string): string | null {
    const state = this.state();
    if (!state) {
      return null;
    }

    // The slug must match up to a path boundary: "acme" is not allowed to answer for "acme-two".
    const base = this.url(state.slug);
    return url === base || url.startsWith(`${base}/`) || url.startsWith(`${base}?`)
      ? state.accessToken
      : null;
  }

  loadInfo(slug: string): Observable<PortalInfo> {
    return this.http.get<PortalInfo>(this.url(slug), open());
  }

  /** Asks for a sign-up email. The password is chosen later, from the link in that email. */
  register(slug: string, fullName: string, email: string): Observable<void> {
    return this.http.post<void>(this.url(slug, '/auth/register'), { fullName, email }, open());
  }

  login(slug: string, email: string, password: string): Observable<PortalCustomer> {
    return this.http
      .post<PortalAuthResponse>(this.url(slug, '/auth/login'), { email, password }, open())
      .pipe(map((response) => this.accept(slug, response)));
  }

  forgotPassword(slug: string, email: string): Observable<void> {
    return this.http.post<void>(this.url(slug, '/auth/forgot-password'), { email }, open());
  }

  resetPassword(slug: string, token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      this.url(slug, '/auth/reset-password'),
      { token, newPassword },
      open(),
    );
  }

  /** Rotates the portal refresh cookie. Concurrent callers share one request. */
  refresh(): Observable<string> {
    const slug = this.state()?.slug ?? this.info()?.slug ?? '';
    this.refreshInFlight ??= defer(() => this.rotate(slug)).pipe(
      map((response) => response.accessToken),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** Restores the customer's session for this workspace when this browser signed in there before. */
  async restore(slug: string): Promise<void> {
    if (this.state()?.slug === slug) {
      return;
    }

    this.state.set(null);
    if (readStored(hintKey(slug)) === null) {
      return;
    }

    try {
      await this.rotate(slug);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        removeStored(hintKey(slug));
      }
    }
  }

  logout(): Observable<void> {
    const slug = this.state()?.slug ?? '';
    return this.http
      .post<void>(this.url(slug, '/auth/logout'), null, open())
      .pipe(finalize(() => this.clear()));
  }

  clear(): void {
    const slug = this.state()?.slug;
    this.state.set(null);
    if (slug) {
      removeStored(hintKey(slug));
    }
  }

  tickets(slug: string): Observable<Paged<PortalTicketListItem>> {
    return this.http.get<Paged<PortalTicketListItem>>(this.url(slug, '/tickets'), {
      params: new HttpParams().set('pageSize', 100),
    });
  }

  ticket(slug: string, ticketId: string): Observable<PortalTicket> {
    return this.http.get<PortalTicket>(this.url(slug, `/tickets/${ticketId}`), inline());
  }

  createTicket(
    slug: string,
    subject: string,
    description: string,
    attachmentIds: readonly string[],
  ): Observable<PortalTicket> {
    return this.http.post<PortalTicket>(
      this.url(slug, '/tickets'),
      { subject, description, attachmentIds },
      inline(),
    );
  }

  reply(
    slug: string,
    ticketId: string,
    body: string,
    attachmentIds: readonly string[],
  ): Observable<PortalTicket> {
    return this.http.post<PortalTicket>(
      this.url(slug, `/tickets/${ticketId}/replies`),
      { body, attachmentIds },
      inline(),
    );
  }

  rate(
    slug: string,
    ticketId: string,
    rating: number,
    comment: string | null,
  ): Observable<PortalTicket> {
    return this.http.post<PortalTicket>(this.url(slug, `/tickets/${ticketId}/csat`), {
      rating,
      comment,
    });
  }

  upload(slug: string, file: File): Observable<Attachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Attachment>(this.url(slug, '/attachments'), form, inline());
  }

  download(slug: string, attachmentId: string): Observable<Blob> {
    return this.http.get(this.url(slug, `/attachments/${attachmentId}`), { responseType: 'blob' });
  }

  survey(slug: string, token: string): Observable<CsatSurvey> {
    return this.http.get<CsatSurvey>(this.url(slug, '/csat'), {
      params: new HttpParams().set('token', token),
      ...open(),
    });
  }

  submitSurvey(
    slug: string,
    token: string,
    rating: number,
    comment: string | null,
  ): Observable<CsatSurvey> {
    return this.http.post<CsatSurvey>(this.url(slug, '/csat'), { token, rating, comment }, open());
  }

  helpCategories(slug: string): Observable<HelpCategory[]> {
    return this.http.get<HelpCategory[]>(this.url(slug, '/kb/categories'), inline());
  }

  /** Published articles, optionally narrowed to those matching what the reader typed. */
  helpArticles(slug: string, search = '', limit = 100): Observable<HelpArticleSummary[]> {
    let params = new HttpParams().set('limit', limit);
    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<HelpArticleSummary[]>(this.url(slug, '/kb/articles'), {
      params,
      ...inline(),
    });
  }

  helpArticle(slug: string, articleSlug: string): Observable<HelpArticle> {
    return this.http.get<HelpArticle>(
      this.url(slug, `/kb/articles/${encodeURIComponent(articleSlug)}`),
      inline(),
    );
  }

  rateHelpArticle(slug: string, articleSlug: string, helpful: boolean): Observable<void> {
    return this.http.post<void>(
      this.url(slug, `/kb/articles/${encodeURIComponent(articleSlug)}/feedback`),
      { helpful },
      inline(),
    );
  }

  private rotate(slug: string): Promise<PortalAuthResponse> {
    const request = async () => {
      const response = await firstValueFrom(
        this.http.post<PortalAuthResponse>(this.url(slug, '/auth/refresh'), null, open()),
      );
      this.accept(slug, response);
      return response;
    };

    const locks = globalThis.navigator?.locks;
    return locks ? locks.request(`nexdesk.portal.refresh.${slug}`, request) : request();
  }

  private accept(slug: string, response: PortalAuthResponse): PortalCustomer {
    this.state.set({
      slug,
      accessToken: response.accessToken,
      customer: response.customer,
    });
    writeStored(hintKey(slug), '1');
    return response.customer;
  }
}

function hintKey(slug: string): string {
  return `nexdesk.portal.${slug}`;
}
