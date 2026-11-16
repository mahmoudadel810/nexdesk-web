import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../public/i18n/en.json';
import { BusinessHours } from '../core/api/workspace.api';
import { TEST_SESSION, authResponse } from '../core/auth/auth-testing';
import { Session } from '../core/auth/auth.models';
import { onboardingGuard } from '../core/auth/auth.guards';
import { AuthService } from '../core/auth/auth.service';
import { BusinessHoursForm } from './business-hours-form';
import { formatLocalDate } from './local-date.pipe';

describe('formatLocalDate', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it('describes recent moments relative to now in the requested language', () => {
    expect(formatLocalDate('2026-11-17T11:57:00Z', 'en', 'relative', now)).toBe('3 minutes ago');
    expect(formatLocalDate('2026-11-19T12:00:00Z', 'en', 'relative', now)).toBe('in 2 days');
    expect(formatLocalDate('2026-11-16T12:00:00Z', 'ar', 'relative', now)).toBe('أمس');
  });

  it('returns an empty string for missing or malformed values', () => {
    expect(formatLocalDate(null, 'en')).toBe('');
    expect(formatLocalDate('not a date', 'en')).toBe('');
  });

  it('formats absolute dates', () => {
    expect(formatLocalDate('2026-03-05T00:00:00', 'en', 'date')).toBe('Mar 5, 2026');
  });
});

describe('onboardingGuard', () => {
  function run(session: Session): string | boolean {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthService).login('a', 'b').subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush({ ...authResponse(), session });

    const result = TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, { url: '/app' } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  const pending = { ...TEST_SESSION.tenant!, onboardingCompleted: false };

  it('sends an admin of a new workspace to the setup wizard', () => {
    expect(run({ ...TEST_SESSION, tenant: pending, permissions: ['settings.manage'] })).toBe(
      '/onboarding',
    );
  });

  it('lets agents in even when the workspace is not set up yet', () => {
    expect(run({ ...TEST_SESSION, tenant: pending, permissions: ['tickets.view'] })).toBe(true);
  });

  it('lets everyone in once setup is finished', () => {
    expect(run({ ...TEST_SESSION, permissions: ['settings.manage'] })).toBe(true);
  });
});

describe('BusinessHoursForm', () => {
  const hours: BusinessHours = {
    timezone: 'Africa/Cairo',
    days: (
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
    ).map((day) => ({
      day,
      isWorkingDay: day !== 'Friday' && day !== 'Saturday',
      startTime: '09:00:00',
      endTime: '17:00:00',
    })),
  };

  async function create(value: BusinessHours) {
    TestBed.configureTestingModule({
      imports: [
        BusinessHoursForm,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    });
    const fixture = TestBed.createComponent(BusinessHoursForm);
    fixture.componentRef.setInput('hours', value);
    await fixture.whenStable();
    return fixture;
  }

  it('round-trips the hours it was given in the API time format', async () => {
    const fixture = await create(hours);

    expect(fixture.componentInstance.isValid()).toBe(true);
    expect(fixture.componentInstance.value()).toEqual(hours);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input[type=time]').length).toBe(
      10,
    );
  });

  it('is invalid when a working day closes before it opens or no day is open', async () => {
    const inverted = await create({
      ...hours,
      days: hours.days.map((day) => ({ ...day, startTime: '18:00:00', endTime: '09:00:00' })),
    });
    expect(inverted.componentInstance.isValid()).toBe(false);
    expect((inverted.nativeElement as HTMLElement).textContent).toContain(
      en.businessHours.invalidRange,
    );

    TestBed.resetTestingModule();
    const closed = await create({
      ...hours,
      days: hours.days.map((day) => ({ ...day, isWorkingDay: false })),
    });
    expect(closed.componentInstance.isValid()).toBe(false);
    expect((closed.nativeElement as HTMLElement).textContent).toContain(
      en.businessHours.needWorkingDay,
    );
  });
});
