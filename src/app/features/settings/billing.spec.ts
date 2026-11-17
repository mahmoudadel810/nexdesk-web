import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { Plan, Subscription, Usage, formatMoney } from '../../core/api/billing.api';
import { TEST_SESSION, authResponse } from '../../core/auth/auth-testing';
import { Session } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Notifier } from '../../core/ui/notifier';
import { Billing, toMeters } from './billing';
import { CheckoutDialog } from './checkout-dialog';

const GB = 1024 ** 3;
const FREE: Plan = {
  code: 'free',
  name: 'Free',
  priceCentsMonthly: 0,
  currency: 'USD',
  maxAgents: 3,
  maxTicketsPerMonth: 100,
  maxStorageBytes: GB,
  maxAutomationRules: 3,
  apiAccess: false,
  requestsPerMinute: 120,
};
const PRO: Plan = { ...FREE, code: 'pro', name: 'Pro', priceCentsMonthly: 2900, maxAgents: 10 };
const BUSINESS: Plan = {
  ...FREE,
  code: 'business',
  name: 'Business',
  priceCentsMonthly: 9900,
  maxAgents: null,
  maxTicketsPerMonth: null,
  maxAutomationRules: null,
  apiAccess: true,
};
const USAGE: Usage = {
  agents: 3,
  maxAgents: 3,
  ticketsThisMonth: 95,
  maxTicketsPerMonth: 100,
  storageBytes: GB / 2,
  maxStorageBytes: GB,
  automationRules: 1,
  maxAutomationRules: null,
  apiAccess: false,
};
const ON_FREE: Subscription = {
  plan: FREE,
  currentPeriodStart: '2026-11-01T00:00:00Z',
  currentPeriodEnd: null,
  cardBrand: null,
  cardLast4: null,
};

const translations = TranslocoTestingModule.forRoot({
  langs: { en },
  translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
  preloadLangs: true,
});

function signIn(backend: HttpTestingController, session: Session): void {
  TestBed.inject(AuthService).login('a', 'b').subscribe();
  backend.expectOne('/api/v1/auth/login').flush({ ...authResponse(), session });
}

describe('Billing helpers', () => {
  it('turns usage into meters, with no bar for unlimited allowances', () => {
    const meters = toMeters(USAGE, String);

    expect(meters.map((meter) => [meter.key, meter.used, meter.limit, meter.percent])).toEqual([
      ['agents', '3', '3', 100],
      ['tickets', '95', '100', 95],
      ['storage', '512.0 MB', '1.0 GB', 50],
      ['automation', '1', null, 0],
    ]);
    expect(toMeters({ ...USAGE, agents: 9 }, String)[0].percent).toBe(100);
  });

  it('formats prices without decimals unless they are needed', () => {
    expect(formatMoney(2900, 'USD', 'en')).toBe('$29');
    expect(formatMoney(2950, 'USD', 'en')).toBe('$29.50');
    expect(formatMoney(0, 'USD', 'en')).toBe('$0');
  });
});

describe('Billing', () => {
  let backend: HttpTestingController;

  async function render(session: Session): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Billing, translations],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    signIn(backend, session);

    const fixture = TestBed.createComponent(Billing);
    await fixture.whenStable();
    backend.expectOne('/api/v1/billing/plans').flush([FREE, PRO, BUSINESS]);
    backend.expectOne('/api/v1/billing/subscription').flush(ON_FREE);
    backend.expectOne('/api/v1/billing/usage').flush(USAGE);
    if (session.permissions.includes('billing.manage')) {
      backend
        .expectOne((request) => request.url === '/api/v1/billing/invoices')
        .flush({ items: [], page: 1, pageSize: 10, totalCount: 0 });
    }

    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => backend.verify());

  it('shows the owner the plan, usage, the other plans and the invoices', async () => {
    const element = await render({
      ...TEST_SESSION,
      permissions: ['settings.manage', 'billing.manage'],
    });

    expect(element.querySelector('.overview mat-card-title')?.textContent).toContain('Free');
    expect(element.querySelectorAll('.meters li').length).toBe(4);
    expect(element.querySelectorAll('.meters mat-progress-bar').length).toBe(3);
    expect(element.querySelectorAll('.nearly-full').length).toBe(2);
    expect(element.textContent).toContain('95 of 100');

    const buttons = [...element.querySelectorAll('.plans button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(buttons).toEqual(['Upgrade to Pro', 'Upgrade to Business']);
    expect(element.textContent).toContain('Unlimited team members');
    expect(element.textContent).toContain('No invoices yet');
  });

  it('lets an admin look but not pay', async () => {
    const element = await render({ ...TEST_SESSION, permissions: ['settings.manage'] });

    expect(element.querySelectorAll('.plans button').length).toBe(0);
    expect(element.textContent).toContain('Only an owner can change the plan.');
    expect(element.textContent).not.toContain('Invoices');
  });
});

describe('CheckoutDialog', () => {
  let backend: HttpTestingController;
  let closed: Subscription | undefined;

  async function open(plan: Plan, current: Plan) {
    closed = undefined;
    TestBed.configureTestingModule({
      imports: [CheckoutDialog, translations],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { plan, current } },
        { provide: MatDialogRef, useValue: { close: (value: Subscription) => (closed = value) } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CheckoutDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const click = async (label: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent?.includes(label))?.click();
      await fixture.whenStable();
    };
    const type = async (name: string, value: string) => {
      const input = element.querySelector(`input[formControlName=${name}]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { element, click, type };
  }

  afterEach(() => backend.verify());

  it('says the payment is simulated and pays with the test card', async () => {
    const { element, click, type } = await open(PRO, FREE);
    expect(element.textContent).toContain('This is a simulated payment');

    await click('Pay $29');
    backend.expectNone('/api/v1/billing/checkout');

    await type('cardholderName', 'Olivia Owner');
    await click('Fill in a test card');
    await click('Pay $29');
    const request = backend.expectOne('/api/v1/billing/checkout');
    expect(request.request.body).toEqual({
      planCode: 'pro',
      cardholderName: 'Olivia Owner',
      cardNumber: '4242 4242 4242 4242',
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 2,
      cvc: '123',
    });
    request.flush({ ...ON_FREE, plan: PRO });
    expect(closed?.plan.code).toBe('pro');
  });

  it('shows why a payment or a downgrade was refused', async () => {
    const { element, click } = await open(FREE, PRO);
    expect(element.querySelector('input')).toBeNull();

    await click('Switch plan');
    const request = backend.expectOne('/api/v1/billing/checkout');
    expect(request.request.body).toEqual({ planCode: 'free' });
    request.flush({ code: 'downgrade-agents' }, { status: 409, statusText: 'Conflict' });
    await new Promise((resolve) => setTimeout(resolve));

    expect(element.querySelector('.form-alert')?.textContent).toContain('fewer team members');
    expect(closed).toBeUndefined();
  });
});

describe('Plan limit prompt', () => {
  it('offers the plans to people who can see them and only explains to everyone else', () => {
    const actions = new Subject<void>();
    const opened: unknown[][] = [];
    const snackBar = {
      open: (...args: unknown[]) => {
        opened.push(args);
        return { onAction: () => actions };
      },
    };
    TestBed.configureTestingModule({
      imports: [translations],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const notifier = TestBed.inject(Notifier);
    const limit = { status: 402, code: 'plan-limit-agents' };

    signIn(backend, { ...TEST_SESSION, permissions: ['users.manage'] });
    notifier.problem(limit);
    expect(opened[0][1]).toBe('Dismiss');

    signIn(backend, { ...TEST_SESSION, permissions: ['users.manage', 'settings.manage'] });
    notifier.problem(limit);
    expect(opened[1][0]).toContain('team member limit');
    expect(opened[1][1]).toBe('View plans');
    actions.next();
    expect(navigate).toHaveBeenCalledWith('/app/settings/billing');
  });
});
