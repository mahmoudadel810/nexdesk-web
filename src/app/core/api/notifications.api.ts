import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paged } from './workspace.api';

export type NotificationType =
  'TicketAssigned' | 'TicketReply' | 'TicketNote' | 'SlaWarning' | 'SlaBreach';

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  'TicketAssigned',
  'TicketReply',
  'TicketNote',
  'SlaWarning',
  'SlaBreach',
];

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly ticketId: string;
  readonly ticketNumber: number;
  readonly ticketSubject: string;
  readonly actorName: string | null;
  readonly preview: string | null;
  readonly createdAt: string;
  readonly isRead: boolean;
}

export interface NotificationPreference {
  readonly type: NotificationType;
  readonly inApp: boolean;
  readonly email: boolean;
}

const API = `${environment.apiUrl}/notifications`;

@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  list(pageSize: number): Observable<Paged<AppNotification>> {
    return this.http.get<Paged<AppNotification>>(API, {
      params: new HttpParams().set('pageSize', pageSize),
    });
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${API}/unread-count`);
  }

  markRead(notificationId: string): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${API}/${notificationId}/read`, null);
  }

  markAllRead(): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${API}/read-all`, null);
  }

  preferences(): Observable<NotificationPreference[]> {
    return this.http.get<NotificationPreference[]>(`${API}/preferences`);
  }

  updatePreferences(
    preferences: readonly NotificationPreference[],
  ): Observable<NotificationPreference[]> {
    return this.http.put<NotificationPreference[]>(`${API}/preferences`, { preferences });
  }
}
