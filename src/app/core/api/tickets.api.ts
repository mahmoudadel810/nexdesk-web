import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { Paged } from './workspace.api';

export type TicketStatus = 'New' | 'Open' | 'Pending' | 'OnHold' | 'Solved' | 'Closed';
export type TicketPriority = 'Low' | 'Normal' | 'High' | 'Urgent';
export type TicketType = 'Question' | 'Incident' | 'Problem' | 'Task';
export type TicketChannel = 'Agent' | 'Portal' | 'Email' | 'Api';

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'New',
  'Open',
  'Pending',
  'OnHold',
  'Solved',
  'Closed',
];
export const TICKET_PRIORITIES: readonly TicketPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
export const TICKET_TYPES: readonly TicketType[] = ['Question', 'Incident', 'Problem', 'Task'];

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
}

export interface TeamRef {
  readonly id: string;
  readonly name: string;
}

export interface TicketListItem {
  readonly id: string;
  readonly number: number;
  readonly subject: string;
  readonly status: TicketStatus;
  readonly priority: TicketPriority;
  readonly type: TicketType;
  readonly channel: TicketChannel;
  readonly requester: PersonRef;
  readonly assignee: PersonRef | null;
  readonly team: TeamRef | null;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly lastActivityAt: string;
}

export interface TicketDetail extends TicketListItem {
  readonly firstRespondedAt: string | null;
  readonly solvedAt: string | null;
  readonly closedAt: string | null;
  readonly watchers: readonly PersonRef[];
  readonly isWatching: boolean;
}

export interface Attachment {
  readonly id: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export type ActorType = 'Staff' | 'Customer' | 'System';

export type TicketEventType =
  | 'Created'
  | 'SubjectChanged'
  | 'StatusChanged'
  | 'PriorityChanged'
  | 'TypeChanged'
  | 'AssigneeChanged'
  | 'TeamChanged'
  | 'TagsChanged';

export interface TimelineItem {
  readonly id: string;
  readonly kind: 'Message' | 'Event';
  readonly createdAt: string;
  readonly actor: {
    readonly type: ActorType;
    readonly id: string | null;
    readonly name: string | null;
  };
  readonly body: string | null;
  readonly isInternal: boolean;
  readonly attachments: readonly Attachment[];
  readonly eventType: TicketEventType | null;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export interface TicketFilter {
  readonly status?: readonly TicketStatus[];
  readonly priority?: readonly TicketPriority[];
  readonly assigneeId?: string | null;
  readonly unassigned?: boolean;
  readonly teamId?: string | null;
  readonly tag?: string;
  readonly sort?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface NewTicket {
  readonly subject: string;
  readonly description: string;
  readonly requesterEmail: string;
  readonly requesterName: string | null;
  readonly priority: TicketPriority;
  readonly type: TicketType;
  readonly assigneeId: string | null;
  readonly teamId: string | null;
  readonly tags: readonly string[];
  readonly attachmentIds: readonly string[];
}

export interface TicketChanges {
  readonly subject?: string;
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly type?: TicketType;
  readonly tags?: readonly string[];
}

export interface NewMessage {
  readonly body: string;
  readonly isInternal: boolean;
  readonly attachmentIds: readonly string[];
  readonly setStatus: TicketStatus | null;
}

export interface Customer {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly createdAt: string;
}

const API = environment.apiUrl;

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class TicketsApi {
  private readonly http = inject(HttpClient);

  list(filter: TicketFilter): Observable<Paged<TicketListItem>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    for (const status of filter.status ?? []) {
      params = params.append('status', status);
    }

    for (const priority of filter.priority ?? []) {
      params = params.append('priority', priority);
    }

    if (filter.unassigned) {
      params = params.set('unassigned', true);
    } else if (filter.assigneeId) {
      params = params.set('assigneeId', filter.assigneeId);
    }

    if (filter.teamId) {
      params = params.set('teamId', filter.teamId);
    }

    if (filter.tag) {
      params = params.set('tag', filter.tag);
    }

    if (filter.sort) {
      params = params.set('sort', filter.sort);
    }

    return this.http.get<Paged<TicketListItem>>(`${API}/tickets`, { params });
  }

  get(ticketId: string): Observable<TicketDetail> {
    return this.http.get<TicketDetail>(`${API}/tickets/${ticketId}`, inline());
  }

  timeline(ticketId: string): Observable<TimelineItem[]> {
    return this.http.get<TimelineItem[]>(`${API}/tickets/${ticketId}/timeline`);
  }

  create(ticket: NewTicket): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${API}/tickets`, ticket, inline());
  }

  update(ticketId: string, changes: TicketChanges): Observable<TicketDetail> {
    return this.http.patch<TicketDetail>(`${API}/tickets/${ticketId}`, changes);
  }

  assign(
    ticketId: string,
    assigneeId: string | null,
    teamId: string | null,
  ): Observable<TicketDetail> {
    return this.http.put<TicketDetail>(`${API}/tickets/${ticketId}/assignment`, {
      assigneeId,
      teamId,
    });
  }

  addMessage(ticketId: string, message: NewMessage): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${API}/tickets/${ticketId}/messages`, message, inline());
  }

  setWatching(ticketId: string, watching: boolean): Observable<TicketDetail> {
    const url = `${API}/tickets/${ticketId}/watchers/me`;
    return watching ? this.http.put<TicketDetail>(url, null) : this.http.delete<TicketDetail>(url);
  }

  delete(ticketId: string): Observable<void> {
    return this.http.delete<void>(`${API}/tickets/${ticketId}`);
  }

  upload(file: File): Observable<Attachment> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<Attachment>(`${API}/attachments`, form, inline());
  }

  download(attachmentId: string): Observable<Blob> {
    return this.http.get(`${API}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  customers(search: string): Observable<Paged<Customer>> {
    return this.http.get<Paged<Customer>>(`${API}/customers`, {
      params: new HttpParams().set('search', search).set('pageSize', 8),
    });
  }
}
