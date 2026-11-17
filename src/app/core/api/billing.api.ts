import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { Paged } from './workspace.api';

/** A subscription tier. A limit of null means unlimited. */
export interface Plan {
  readonly code: string;
  readonly name: string;
  readonly priceCentsMonthly: number;
  readonly currency: string;
  readonly maxAgents: number | null;
  readonly maxTicketsPerMonth: number | null;
  readonly maxStorageBytes: number;
  readonly maxAutomationRules: number | null;
  readonly apiAccess: boolean;
  readonly requestsPerMinute: number;
}

export interface Subscription {
  readonly plan: Plan;
  readonly currentPeriodStart: string;
  /** When the paid period ends and the plan renews. Null on the free plan. */
  readonly currentPeriodEnd: string | null;
  readonly cardBrand: string | null;
  readonly cardLast4: string | null;
}

export interface Usage {
  readonly agents: number;
  readonly maxAgents: number | null;
  readonly ticketsThisMonth: number;
  readonly maxTicketsPerMonth: number | null;
  readonly storageBytes: number;
  readonly maxStorageBytes: number;
  readonly automationRules: number;
  readonly maxAutomationRules: number | null;
  readonly apiAccess: boolean;
}

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly planCode: string;
  readonly planName: string;
  readonly reason: 'PlanChange' | 'Renewal';
  readonly amountCents: number;
  readonly currency: string;
  readonly issuedAt: string;
  readonly paidAt: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly cardBrand: string | null;
  readonly cardLast4: string | null;
}

/** The fields of the simulated payment form. Nothing is charged and the number is not stored. */
export interface CardDetails {
  readonly cardholderName: string;
  readonly cardNumber: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
  readonly cvc: string;
}

/** Formats an amount of cents in the given language, without decimals for whole amounts. */
export function formatMoney(cents: number, currency: string, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const API = `${environment.apiUrl}/billing`;

@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  plans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${API}/plans`);
  }

  subscription(): Observable<Subscription> {
    return this.http.get<Subscription>(`${API}/subscription`);
  }

  usage(): Observable<Usage> {
    return this.http.get<Usage>(`${API}/usage`);
  }

  checkout(planCode: string, card: CardDetails | null): Observable<Subscription> {
    return this.http.post<Subscription>(
      `${API}/checkout`,
      { planCode, ...card },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  invoices(page: number, pageSize: number): Observable<Paged<Invoice>> {
    return this.http.get<Paged<Invoice>>(`${API}/invoices`, {
      params: new HttpParams().set('page', page).set('pageSize', pageSize),
    });
  }

  invoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${API}/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  }
}
