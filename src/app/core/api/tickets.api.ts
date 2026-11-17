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

/** Deadlines of a ticket. A due date is null when no policy applies or the clock is paused. */
export interface TicketSla {
  readonly firstResponseDueAt: string | null;
  readonly firstResponseBreached: boolean;
  readonly firstResponseMet: boolean;
  readonly resolutionDueAt: string | null;
  readonly resolutionBreached: boolean;
  readonly isPaused: boolean;
  readonly isEscalated: boolean;
}

export type SlaFilter = 'Breached' | 'AtRisk';

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
  readonly sla: TicketSla;
}

export interface TicketDetail extends TicketListItem {
  readonly firstRespondedAt: string | null;
  readonly solvedAt: string | null;
  readonly closedAt: string | null;
  readonly watchers: readonly PersonRef[];
  readonly isWatching: boolean;
  readonly customFields: Readonly<Record<string, string>>;
  readonly mergedInto: {
    readonly id: string;
    readonly number: number;
    readonly subject: string;
  } | null;
  readonly version: number;
  readonly csat: { readonly rating: number; readonly comment: string | null } | null;
}

export type CustomFieldType = 'Text' | 'Number' | 'Dropdown' | 'Checkbox' | 'Date';

export const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = [
  'Text',
  'Number',
  'Dropdown',
  'Checkbox',
  'Date',
];

export interface CustomField {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: CustomFieldType;
  readonly options: readonly string[];
  readonly isRequired: boolean;
  readonly isActive: boolean;
  readonly position: number;
}

export type CustomFieldValues = Readonly<Record<string, string | null>>;

/** The ticket list filter as a saved view stores it. Assignee is "me", "unassigned" or a user id. */
export interface ViewFilter {
  readonly status: readonly TicketStatus[] | null;
  readonly priority: readonly TicketPriority[] | null;
  readonly assignee: string | null;
  readonly teamId: string | null;
  readonly tag: string | null;
  readonly search: string | null;
  readonly sort: string | null;
}

export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly isShared: boolean;
  readonly isMine: boolean;
  readonly filter: ViewFilter;
}

export interface BulkChanges {
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly setAssignee?: boolean;
  readonly assigneeId?: string | null;
  readonly addTags?: readonly string[];
}

export interface BulkResult {
  readonly updated: number;
  readonly failed: readonly { readonly ticketId: string; readonly code: string }[];
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
  | 'TagsChanged'
  | 'CustomFieldChanged'
  | 'MergedInto'
  | 'MergedFrom'
  | 'SlaBreached'
  | 'CsatSubmitted';

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
  readonly field: string | null;
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
  readonly search?: string;
  readonly sla?: SlaFilter | null;
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
  readonly customFields: CustomFieldValues;
}

export interface TicketChanges {
  readonly subject?: string;
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly type?: TicketType;
  readonly tags?: readonly string[];
  readonly customFields?: CustomFieldValues;
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

    if (filter.search) {
      params = params.set('search', filter.search);
    }

    if (filter.sla) {
      params = params.set('sla', filter.sla);
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

  /** Sends the version the caller last saw, so the API rejects the change if the ticket moved on. */
  update(ticketId: string, changes: TicketChanges, version: number): Observable<TicketDetail> {
    return this.http.patch<TicketDetail>(`${API}/tickets/${ticketId}`, { ...changes, version });
  }

  assign(
    ticketId: string,
    assigneeId: string | null,
    teamId: string | null,
    version: number,
  ): Observable<TicketDetail> {
    return this.http.put<TicketDetail>(`${API}/tickets/${ticketId}/assignment`, {
      assigneeId,
      teamId,
      version,
    });
  }

  bulk(ticketIds: readonly string[], changes: BulkChanges): Observable<BulkResult> {
    return this.http.post<BulkResult>(`${API}/tickets/bulk`, { ticketIds, ...changes });
  }

  merge(ticketId: string, targetTicketId: string): Observable<TicketDetail> {
    return this.http.post<TicketDetail>(`${API}/tickets/${ticketId}/merge`, { targetTicketId });
  }

  customFields(): Observable<CustomField[]> {
    return this.http.get<CustomField[]>(`${API}/custom-fields`);
  }

  createCustomField(field: Omit<CustomField, 'id' | 'isActive'>): Observable<CustomField> {
    return this.http.post<CustomField>(`${API}/custom-fields`, field, inline());
  }

  updateCustomField(
    fieldId: string,
    field: Omit<CustomField, 'id' | 'key' | 'type'>,
  ): Observable<CustomField> {
    return this.http.put<CustomField>(`${API}/custom-fields/${fieldId}`, field, inline());
  }

  deleteCustomField(fieldId: string): Observable<void> {
    return this.http.delete<void>(`${API}/custom-fields/${fieldId}`);
  }

  views(): Observable<SavedView[]> {
    return this.http.get<SavedView[]>(`${API}/views`);
  }

  createView(name: string, isShared: boolean, filter: ViewFilter): Observable<SavedView> {
    return this.http.post<SavedView>(`${API}/views`, { name, isShared, filter }, inline());
  }

  deleteView(viewId: string): Observable<void> {
    return this.http.delete<void>(`${API}/views/${viewId}`);
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
