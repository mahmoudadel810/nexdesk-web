import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Actor } from './tickets.api';
import { Paged } from './workspace.api';

export type AuditOperation = 'Created' | 'Updated' | 'Deleted';
export const AUDIT_OPERATIONS: readonly AuditOperation[] = ['Created', 'Updated', 'Deleted'];

/** The kinds of records the audit log covers, as the API names them. */
export const AUDIT_ENTITY_TYPES = [
  'ticket',
  'user',
  'invitation',
  'team',
  'team-member',
  'customer',
  'workspace',
  'business-hours',
  'holiday',
  'sla-policy',
  'custom-field',
  'kb-category',
  'kb-article',
  'automation-rule',
  'subscription',
  'invoice',
  'api-key',
  'webhook',
] as const;

export interface AuditChange {
  readonly field: string;
  readonly before: string | null;
  readonly after: string | null;
}

export interface AuditEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: Actor;
  readonly entityType: string;
  readonly entityId: string;
  readonly entityLabel: string | null;
  readonly operation: AuditOperation;
  readonly changes: readonly AuditChange[];
  readonly ipAddress: string | null;
}

export interface AuditFilter {
  readonly entityType?: string | null;
  readonly operation?: AuditOperation | null;
  readonly search?: string | null;
  /** Instants, both inclusive. */
  readonly from?: string | null;
  readonly to?: string | null;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(filter: AuditFilter): Observable<Paged<AuditEntry>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    for (const key of ['entityType', 'operation', 'search', 'from', 'to'] as const) {
      const value = filter[key];
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.http.get<Paged<AuditEntry>>(`${environment.apiUrl}/audit-logs`, { params });
  }
}
