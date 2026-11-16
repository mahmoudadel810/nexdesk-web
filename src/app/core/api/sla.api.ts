import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { TicketPriority } from './tickets.api';

export interface SlaPolicy {
  readonly priority: TicketPriority;
  /** Working minutes until the first public reply is due. */
  readonly firstResponseMinutes: number;
  /** Working minutes until the ticket should be solved. */
  readonly resolutionMinutes: number;
}

export interface Holiday {
  readonly id: string;
  /** Calendar date as yyyy-MM-dd. */
  readonly date: string;
  readonly name: string;
}

const API = `${environment.apiUrl}/sla`;

@Injectable({ providedIn: 'root' })
export class SlaApi {
  private readonly http = inject(HttpClient);

  policies(): Observable<SlaPolicy[]> {
    return this.http.get<SlaPolicy[]>(`${API}/policies`);
  }

  updatePolicies(policies: readonly SlaPolicy[]): Observable<SlaPolicy[]> {
    return this.http.put<SlaPolicy[]>(`${API}/policies`, { policies });
  }

  holidays(): Observable<Holiday[]> {
    return this.http.get<Holiday[]>(`${API}/holidays`);
  }

  addHoliday(date: string, name: string): Observable<Holiday> {
    return this.http.post<Holiday>(
      `${API}/holidays`,
      { date, name },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  deleteHoliday(holidayId: string): Observable<void> {
    return this.http.delete<void>(`${API}/holidays/${holidayId}`);
  }
}
