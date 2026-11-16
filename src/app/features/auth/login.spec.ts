import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { authResponse } from '../../core/auth/auth-testing';
import { AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let element: HTMLElement;
  let backend: HttpTestingController;
  let navigatedTo: string[];

  beforeEach(async () => {
    localStorage.clear();
    navigatedTo = [];
    TestBed.configureTestingModule({
      imports: [
        Login,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const router = TestBed.inject(Router);
    router.navigateByUrl = (url) => {
      navigatedTo.push(url.toString());
      return Promise.resolve(true);
    };
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Login);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function type(selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('does not call the API while the form is incomplete', async () => {
    await submit();

    backend.expectNone('/api/v1/auth/login');
    expect(element.textContent).toContain(en.validation.required);
  });

  it('signs in and continues to the requested page', async () => {
    fixture.componentRef.setInput('returnUrl', '/app/tickets/42');
    type('input[type=email]', 'olivia@example.test');
    type('input[autocomplete=current-password]', 'Passw0rd-123');
    await submit();

    backend.expectOne('/api/v1/auth/login').flush(authResponse());
    await fixture.whenStable();

    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(true);
    expect(navigatedTo).toEqual(['/app/tickets/42']);
  });

  it('shows the translated reason when the credentials are rejected', async () => {
    type('input[type=email]', 'olivia@example.test');
    type('input[autocomplete=current-password]', 'wrong');
    await submit();

    backend
      .expectOne('/api/v1/auth/login')
      .flush({ code: 'invalid-credentials' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(element.querySelector('[role=alert]')?.textContent).toContain(
      en.errors['invalid-credentials'],
    );
    expect(navigatedTo).toEqual([]);
  });

  it('offers to resend the confirmation email to an unverified account', async () => {
    type('input[type=email]', 'olivia@example.test');
    type('input[autocomplete=current-password]', 'Passw0rd-123');
    await submit();

    backend
      .expectOne('/api/v1/auth/login')
      .flush({ code: 'email-not-verified' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();

    expect(element.querySelector('[role=alert] a')?.textContent).toContain(
      en.auth.login.resendLink,
    );
    expect(TestBed.inject(AuthService).pendingVerificationEmail()).toBe('olivia@example.test');
  });
});
