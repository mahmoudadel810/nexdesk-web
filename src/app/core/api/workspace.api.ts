import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, Session } from '../auth/auth.models';
import { SKIP_ERROR_TOAST } from '../http/problem';

export interface Paged<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
}

export type Availability = 'Online' | 'Away' | 'Offline';

export const AVAILABILITIES: readonly Availability[] = ['Online', 'Away', 'Offline'];

export interface User {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly isActive: boolean;
  readonly availability: Availability;
  readonly emailVerified: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface UserFilter {
  readonly search?: string;
  readonly role?: Role | null;
  readonly isActive?: boolean | null;
  readonly sort?: string;
  readonly page: number;
  readonly pageSize: number;
}

export type InvitationStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired';

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
}

export interface InvitationPreview {
  readonly workspaceName: string;
  readonly email: string;
  readonly role: Role;
}

export interface TeamMember {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly isActive: boolean;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly members: readonly TeamMember[];
  readonly createdAt: string;
}

export type Weekday =
  'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface BusinessDay {
  readonly day: Weekday;
  readonly isWorkingDay: boolean;
  /** Local time as HH:mm:ss. */
  readonly startTime: string;
  readonly endTime: string;
}

export interface BusinessHours {
  readonly timezone: string;
  readonly days: readonly BusinessDay[];
}

export interface OnboardingStatus {
  readonly completed: boolean;
  readonly teamCount: number;
  readonly memberCount: number;
  readonly pendingInvitationCount: number;
}

const API = environment.apiUrl;

/** Requests whose caller shows the failure inside its own form or dialog. */
function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  list(filter: UserFilter): Observable<Paged<User>> {
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.search) {
      params = params.set('search', filter.search);
    }

    if (filter.role) {
      params = params.set('role', filter.role);
    }

    if (filter.isActive !== null && filter.isActive !== undefined) {
      params = params.set('isActive', filter.isActive);
    }

    if (filter.sort) {
      params = params.set('sort', filter.sort);
    }

    return this.http.get<Paged<User>>(`${API}/users`, { params });
  }

  changeRole(userId: string, role: Role): Observable<User> {
    return this.http.put<User>(`${API}/users/${userId}/role`, { role });
  }

  deactivate(userId: string): Observable<User> {
    return this.http.post<User>(`${API}/users/${userId}/deactivate`, null);
  }

  reactivate(userId: string): Observable<User> {
    return this.http.post<User>(`${API}/users/${userId}/reactivate`, null);
  }

  updateProfile(fullName: string, language: string): Observable<Session> {
    return this.http.put<Session>(`${API}/users/me/profile`, { fullName, language }, inline());
  }

  setAvailability(availability: Availability): Observable<User> {
    return this.http.put<User>(`${API}/users/me/availability`, { availability });
  }
}

@Injectable({ providedIn: 'root' })
export class InvitationsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Invitation[]> {
    return this.http.get<Invitation[]>(`${API}/invitations`);
  }

  create(email: string, role: Role): Observable<Invitation> {
    return this.http.post<Invitation>(`${API}/invitations`, { email, role }, inline());
  }

  resend(invitationId: string): Observable<Invitation> {
    return this.http.post<Invitation>(`${API}/invitations/${invitationId}/resend`, null);
  }

  revoke(invitationId: string): Observable<void> {
    return this.http.delete<void>(`${API}/invitations/${invitationId}`);
  }

  lookup(token: string): Observable<InvitationPreview> {
    return this.http.get<InvitationPreview>(`${API}/invitations/lookup`, {
      params: new HttpParams().set('token', token),
      ...inline(),
    });
  }
}

@Injectable({ providedIn: 'root' })
export class TeamsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Team[]> {
    return this.http.get<Team[]>(`${API}/teams`);
  }

  create(name: string, description: string | null, memberIds: readonly string[]): Observable<Team> {
    return this.http.post<Team>(`${API}/teams`, { name, description, memberIds }, inline());
  }

  update(teamId: string, name: string, description: string | null): Observable<Team> {
    return this.http.put<Team>(`${API}/teams/${teamId}`, { name, description }, inline());
  }

  setMembers(teamId: string, userIds: readonly string[]): Observable<Team> {
    return this.http.put<Team>(`${API}/teams/${teamId}/members`, { userIds }, inline());
  }

  delete(teamId: string): Observable<void> {
    return this.http.delete<void>(`${API}/teams/${teamId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApi {
  private readonly http = inject(HttpClient);

  businessHours(): Observable<BusinessHours> {
    return this.http.get<BusinessHours>(`${API}/sla/business-hours`);
  }

  updateBusinessHours(hours: BusinessHours): Observable<BusinessHours> {
    return this.http.put<BusinessHours>(`${API}/sla/business-hours`, hours, inline());
  }

  onboarding(): Observable<OnboardingStatus> {
    return this.http.get<OnboardingStatus>(`${API}/onboarding`);
  }

  completeOnboarding(): Observable<OnboardingStatus> {
    return this.http.post<OnboardingStatus>(`${API}/onboarding/complete`, null);
  }
}
