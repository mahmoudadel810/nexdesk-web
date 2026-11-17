import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { NOTIFICATION_TYPES, NotificationPreference } from '../../core/api/notifications.api';
import { authResponse } from '../../core/auth/auth-testing';
import { AuthService } from '../../core/auth/auth.service';
import { Profile } from './profile';

const translations = TranslocoTestingModule.forRoot({
  langs: { en },
  translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
  preloadLangs: true,
});

const PREFERENCES: NotificationPreference[] = NOTIFICATION_TYPES.map((type) => ({
  type,
  inApp: true,
  email: true,
  push: type !== 'TicketNote',
}));

describe('Profile notification preferences', () => {
  let backend: HttpTestingController;

  async function render(): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Profile, translations],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login('a', 'b').subscribe();
    backend.expectOne('/api/v1/auth/login').flush(authResponse());

    const fixture = TestBed.createComponent(Profile);
    await fixture.whenStable();
    backend.expectOne('/api/v1/notifications/preferences').flush(PREFERENCES);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => backend.verify());

  it('shows a phone column next to the app and email', async () => {
    const element = await render();

    const headings = [...element.querySelectorAll('.preferences thead th')].map((th) =>
      th.textContent?.trim(),
    );
    expect(headings).toEqual([
      en.profile.notifications.event,
      en.profile.notifications.inApp,
      en.profile.notifications.email,
      en.profile.notifications.push,
    ]);

    const note = element.querySelector<HTMLInputElement>(
      `input[aria-label="${en.profile.notifications.types.TicketNote} – ${en.profile.notifications.push}"]`,
    )!;
    expect(note.checked).toBe(false);
  });

  it('saves the phone switch without touching the other channels', async () => {
    const element = await render();

    element
      .querySelector<HTMLInputElement>(
        `input[aria-label="${en.profile.notifications.types.Mention} – ${en.profile.notifications.push}"]`,
      )!
      .click();

    const request = backend.expectOne('/api/v1/notifications/preferences');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      preferences: [{ type: 'Mention', inApp: true, email: true, push: false }],
    });
    request.flush(PREFERENCES);
  });
});
