import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paged } from './workspace.api';

export type TenantStatus = 'Active' | 'Suspended';
export type AdminTenantSort = 'Newest' | 'Oldest' | 'Name' | 'Revenue';
export const ADMIN_TENANT_SORTS: readonly AdminTenantSort[] = [
  'Newest',
  'Oldest',
  'Name',
  'Revenue',
];

export interface AdminTenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly planCode: string;
  readonly planName: string;
  readonly monthlyPriceCents: number;
  readonly agents: number;
  readonly ticketsThisMonth: number;
  readonly ownerEmail: string | null;
  readonly createdAt: string;
}

export interface AdminTenantUsage {
  readonly agents: number;
  readonly maxAgents: number | null;
  readonly ticketsThisMonth: number;
  readonly maxTicketsPerMonth: number | null;
  readonly storageBytes: number;
  readonly maxStorageBytes: number;
  readonly automationRules: number;
  readonly maxAutomationRules: number | null;
  readonly activeApiKeys: number;
  readonly webhooks: number;
}

export interface AdminTenantDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly suspendedAt: string | null;
  readonly suspensionReason: string | null;
  readonly timezone: string;
  readonly defaultLanguage: string;
  readonly onboardingCompleted: boolean;
  readonly createdAt: string;
  readonly planCode: string;
  readonly planName: string;
  readonly monthlyPriceCents: number;
  readonly currentPeriodEnd: string | null;
  readonly usage: AdminTenantUsage;
  readonly totals: {
    readonly tickets: number;
    readonly openTickets: number;
    readonly customers: number;
    readonly kbArticles: number;
    readonly lastTicketActivityAt: string | null;
  };
  readonly admins: readonly {
    readonly fullName: string;
    readonly email: string;
    readonly role: string;
    readonly isActive: boolean;
    readonly lastLoginAt: string | null;
  }[];
  readonly recentInvoices: readonly {
    readonly number: string;
    readonly planName: string;
    readonly amountCents: number;
    readonly currency: string;
    readonly issuedAt: string;
  }[];
}

export interface MonthlyPoint {
  /** The first day of the month, yyyy-mm-dd. */
  readonly month: string;
  readonly value: number;
}

export interface PlatformMetrics {
  readonly overview: {
    readonly workspaces: number;
    readonly activeWorkspaces: number;
    readonly suspendedWorkspaces: number;
    readonly payingWorkspaces: number;
    readonly mrrCents: number;
    readonly currency: string;
    readonly signupsLast30Days: number;
    readonly plans: readonly {
      readonly planCode: string;
      readonly planName: string;
      readonly workspaces: number;
      readonly mrrCents: number;
    }[];
  };
  readonly mrr: readonly MonthlyPoint[];
  readonly signups: readonly MonthlyPoint[];
}

export interface AdminTenantFilter {
  readonly search?: string | null;
  readonly status?: TenantStatus | null;
  readonly plan?: string | null;
  readonly sort: AdminTenantSort;
  readonly page: number;
  readonly pageSize: number;
}

const API = `${environment.apiUrl}/admin`;

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  tenants(filter: AdminTenantFilter): Observable<Paged<AdminTenant>> {
    let params = new HttpParams()
      .set('sort', filter.sort)
      .set('page', filter.page)
      .set('pageSize', filter.pageSize);
    for (const key of ['search', 'status', 'plan'] as const) {
      const value = filter[key];
      if (value) {
        params = params.set(key, value);
      }
    }

    return this.http.get<Paged<AdminTenant>>(`${API}/tenants`, { params });
  }

  tenant(id: string): Observable<AdminTenantDetail> {
    return this.http.get<AdminTenantDetail>(`${API}/tenants/${id}`);
  }

  suspend(id: string, reason: string): Observable<AdminTenantDetail> {
    return this.http.post<AdminTenantDetail>(`${API}/tenants/${id}/suspend`, { reason });
  }

  reactivate(id: string): Observable<AdminTenantDetail> {
    return this.http.post<AdminTenantDetail>(`${API}/tenants/${id}/reactivate`, null);
  }

  metrics(months = 12): Observable<PlatformMetrics> {
    return this.http.get<PlatformMetrics>(`${API}/metrics`, {
      params: new HttpParams().set('months', months),
    });
  }

  jobsDashboardLink(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${API}/jobs-dashboard`, null);
  }
}
