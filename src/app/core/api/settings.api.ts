import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';

export interface WorkspaceSettings {
  readonly name: string;
  readonly slug: string;
  readonly timezone: string;
  readonly defaultLanguage: 'en' | 'ar';
  /** #rrggbb, or null for NexDesk's own colour. */
  readonly brandColor: string | null;
  readonly portalWelcomeText: string | null;
  /** A versioned address of the logo, or null when there is none. */
  readonly logoUrl: string | null;
}

export type WorkspaceSettingsInput = Pick<
  WorkspaceSettings,
  'name' | 'timezone' | 'defaultLanguage' | 'brandColor' | 'portalWelcomeText'
>;

/** What the API accepts as a logo. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const LOGO_MAX_BYTES = 512 * 1024;

const API = `${environment.apiUrl}/settings`;

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  get(): Observable<WorkspaceSettings> {
    return this.http.get<WorkspaceSettings>(API);
  }

  update(input: WorkspaceSettingsInput): Observable<WorkspaceSettings> {
    return this.http.put<WorkspaceSettings>(API, input, inline());
  }

  uploadLogo(file: File): Observable<WorkspaceSettings> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<WorkspaceSettings>(`${API}/logo`, form, inline());
  }

  removeLogo(): Observable<WorkspaceSettings> {
    return this.http.delete<WorkspaceSettings>(`${API}/logo`);
  }
}
