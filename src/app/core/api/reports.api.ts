import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { TicketPriority, TicketStatus } from './tickets.api';

/** The days a report covers, both inclusive, as yyyy-MM-dd in the workspace's time zone. */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface ReportRange extends DateRange {
  readonly timezone: string;
  readonly bucket: 'Day' | 'Week';
}

export interface Overview {
  readonly range: ReportRange;
  readonly created: number;
  readonly solved: number;
  readonly previousCreated: number;
  readonly previousSolved: number;
  readonly openBacklog: number;
  readonly avgFirstResponseMinutes: number | null;
  readonly avgResolutionMinutes: number | null;
  readonly slaCompliancePercent: number | null;
  readonly csatAverage: number | null;
  readonly csatResponses: number;
}

export interface VolumePoint {
  readonly date: string;
  readonly created: number;
  readonly solved: number;
}

export interface Backlog {
  readonly byStatus: readonly { readonly status: TicketStatus; readonly count: number }[];
  readonly byPriority: readonly { readonly priority: TicketPriority; readonly count: number }[];
  readonly unassigned: number;
}

export interface ResponseTimePoint {
  readonly date: string;
  readonly avgFirstResponseMinutes: number | null;
  readonly avgResolutionMinutes: number | null;
}

export interface SlaComplianceRow {
  readonly priority: TicketPriority;
  readonly firstResponseMet: number;
  readonly firstResponseBreached: number;
  readonly resolutionMet: number;
  readonly resolutionBreached: number;
  readonly firstResponsePercent: number | null;
  readonly resolutionPercent: number | null;
}

export interface SlaCompliance {
  readonly firstResponsePercent: number | null;
  readonly resolutionPercent: number | null;
  readonly byPriority: readonly SlaComplianceRow[];
}

export interface CsatReport {
  readonly average: number | null;
  readonly responses: number;
  readonly satisfiedPercent: number | null;
  readonly distribution: readonly { readonly rating: number; readonly count: number }[];
  readonly trend: readonly {
    readonly date: string;
    readonly average: number | null;
    readonly responses: number;
  }[];
}

export interface AgentRow {
  readonly userId: string;
  readonly name: string;
  readonly assignedOpen: number;
  readonly solved: number;
  readonly avgFirstResponseMinutes: number | null;
  readonly avgResolutionMinutes: number | null;
  readonly csatAverage: number | null;
  readonly csatResponses: number;
}

export type ReportName =
  'volume' | 'backlog' | 'response-times' | 'sla-compliance' | 'csat' | 'agents' | 'tickets';

export const REPORT_NAMES: readonly ReportName[] = [
  'tickets',
  'volume',
  'backlog',
  'response-times',
  'sla-compliance',
  'csat',
  'agents',
];

/** The last `days` days ending today, in the browser's calendar. The API clamps to the workspace's. */
export function lastDays(days: number, today: Date = new Date()): DateRange {
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: isoDate(start), to: isoDate(today) };
}

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const API = `${environment.apiUrl}/reports`;

/** Report pages show a failure in place, so the request does not also raise a toast. */
function params(range: DateRange | null): { params?: HttpParams; context: HttpContext } {
  const context = new HttpContext().set(SKIP_ERROR_TOAST, true);
  return range
    ? { params: new HttpParams().set('from', range.from).set('to', range.to), context }
    : { context };
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);

  overview(range: DateRange | null): Observable<Overview> {
    return this.http.get<Overview>(`${API}/overview`, params(range));
  }

  volume(range: DateRange | null): Observable<VolumePoint[]> {
    return this.http.get<VolumePoint[]>(`${API}/volume`, params(range));
  }

  backlog(): Observable<Backlog> {
    return this.http.get<Backlog>(`${API}/backlog`, params(null));
  }

  responseTimes(range: DateRange | null): Observable<ResponseTimePoint[]> {
    return this.http.get<ResponseTimePoint[]>(`${API}/response-times`, params(range));
  }

  slaCompliance(range: DateRange | null): Observable<SlaCompliance> {
    return this.http.get<SlaCompliance>(`${API}/sla-compliance`, params(range));
  }

  csat(range: DateRange | null): Observable<CsatReport> {
    return this.http.get<CsatReport>(`${API}/csat`, params(range));
  }

  agents(range: DateRange | null): Observable<AgentRow[]> {
    return this.http.get<AgentRow[]>(`${API}/agents`, params(range));
  }

  exportCsv(name: ReportName, range: DateRange | null): Observable<Blob> {
    return this.http.get(`${API}/${name}/export.csv`, { ...params(range), responseType: 'blob' });
  }
}
