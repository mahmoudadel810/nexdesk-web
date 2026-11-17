import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { Paged } from './workspace.api';

export type ApiScope = 'tickets:read' | 'tickets:write';
export const API_SCOPES: readonly ApiScope[] = ['tickets:read', 'tickets:write'];

export type WebhookEvent =
  'ticket.created' | 'ticket.updated' | 'ticket.assigned' | 'ticket.replied' | 'ticket.solved';

export const WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.replied',
  'ticket.solved',
];

export type WebhookDeliveryStatus = 'Pending' | 'Succeeded' | 'Failed';

export interface ApiKey {
  readonly id: string;
  readonly name: string;
  /** The start of the key, enough to recognise it. */
  readonly hint: string;
  readonly scopes: readonly ApiScope[];
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

export interface IssuedApiKey {
  readonly apiKey: ApiKey;
  /** The full key, returned only when it is issued. */
  readonly key: string;
}

export interface ApiKeyInput {
  readonly name: string;
  readonly scopes: readonly ApiScope[];
  readonly expiresInDays: number | null;
}

export interface WebhookEndpoint {
  readonly id: string;
  readonly url: string;
  readonly description: string | null;
  readonly events: readonly WebhookEvent[];
  readonly isEnabled: boolean;
  readonly createdAt: string;
}

export interface WebhookSecret {
  readonly endpoint: WebhookEndpoint;
  /** The signing secret, returned only when it is created or rotated. */
  readonly secret: string;
}

export interface WebhookInput {
  readonly url: string;
  readonly description: string | null;
  readonly events: readonly WebhookEvent[];
}

export interface WebhookDelivery {
  readonly id: string;
  readonly endpointId: string;
  readonly event: string;
  readonly status: WebhookDeliveryStatus;
  readonly attempts: number;
  readonly responseStatus: number | null;
  readonly responseBody: string | null;
  readonly error: string | null;
  readonly durationMs: number | null;
  readonly payload: string;
  readonly resentFromId: string | null;
  readonly createdAt: string;
  readonly lastAttemptAt: string | null;
  readonly nextAttemptAt: string | null;
}

/** Whether a key can still be used: not revoked and not past its expiry. */
export function isKeyActive(key: ApiKey, now = new Date()): boolean {
  return key.revokedAt === null && (key.expiresAt === null || new Date(key.expiresAt) > now);
}

const KEYS = `${environment.apiUrl}/api-keys`;
const WEBHOOKS = `${environment.apiUrl}/webhooks`;

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class DeveloperApi {
  private readonly http = inject(HttpClient);

  keys(): Observable<ApiKey[]> {
    return this.http.get<ApiKey[]>(KEYS);
  }

  issueKey(input: ApiKeyInput): Observable<IssuedApiKey> {
    return this.http.post<IssuedApiKey>(KEYS, input, inline());
  }

  revokeKey(keyId: string): Observable<ApiKey> {
    return this.http.delete<ApiKey>(`${KEYS}/${keyId}`);
  }

  webhooks(): Observable<WebhookEndpoint[]> {
    return this.http.get<WebhookEndpoint[]>(WEBHOOKS);
  }

  createWebhook(input: WebhookInput): Observable<WebhookSecret> {
    return this.http.post<WebhookSecret>(WEBHOOKS, input, inline());
  }

  updateWebhook(
    id: string,
    input: WebhookInput & { isEnabled: boolean },
  ): Observable<WebhookEndpoint> {
    return this.http.put<WebhookEndpoint>(`${WEBHOOKS}/${id}`, input, inline());
  }

  setWebhookEnabled(endpoint: WebhookEndpoint, isEnabled: boolean): Observable<WebhookEndpoint> {
    return this.http.put<WebhookEndpoint>(`${WEBHOOKS}/${endpoint.id}`, {
      url: endpoint.url,
      description: endpoint.description,
      events: endpoint.events,
      isEnabled,
    });
  }

  deleteWebhook(id: string): Observable<void> {
    return this.http.delete<void>(`${WEBHOOKS}/${id}`);
  }

  rotateSecret(id: string): Observable<WebhookSecret> {
    return this.http.post<WebhookSecret>(`${WEBHOOKS}/${id}/rotate-secret`, null);
  }

  ping(id: string): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${WEBHOOKS}/${id}/ping`, null);
  }

  deliveries(id: string, page: number, pageSize = 20): Observable<Paged<WebhookDelivery>> {
    return this.http.get<Paged<WebhookDelivery>>(`${WEBHOOKS}/${id}/deliveries`, {
      params: new HttpParams().set('page', page).set('pageSize', pageSize),
    });
  }

  resend(deliveryId: string): Observable<WebhookDelivery> {
    return this.http.post<WebhookDelivery>(`${WEBHOOKS}/deliveries/${deliveryId}/resend`, null);
  }
}
