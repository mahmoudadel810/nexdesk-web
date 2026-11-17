import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../public/i18n/en.json';
import { AdminTenantDetail, PlatformMetrics } from '../core/api/admin.api';
import { TEST_SESSION, authResponse } from '../core/auth/auth-testing';
import { guestGuard, platformAdminGuard, workspaceGuard } from '../core/auth/auth.guards';
import { Session } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { AdminOverview, monthLabel } from './admin-overview';
import { AdminTenantDetailPage } from './admin-tenant-detail';

const ADMIN_SESSION: Session = {
  user: { ...TEST_SESSION.user, role: null, isPlatformAdmin: true },
  tenant: null,
  permissions: [],
};

const translations = TranslocoTestingModule.forRoot({
  langs: { en },
  translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
  preloadLangs: true,
});

function configure(): HttpTestingController {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [translations],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.inject(HttpTestingController);
}

function signIn(backend: HttpTestingController, session: Session): void {
  TestBed.inject(AuthService).login('a@example.test', 'secret').subscribe();
  backend.expectOne('/api/v1/auth/login').flush({ ...authResponse(), session });
}

function run(guard: CanActivateFn): string | boolean {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url: '/' } as RouterStateSnapshot),
  );
  return result instanceof UrlTree
    ? TestBed.inject(Router).serializeUrl(result)
    : (result as boolean);
}

describe('Platform admin routing', () => {
  it('sends the platform admin to the console and keeps them out of workspace screens', () => {
    const backend = configure();
    signIn(backend, ADMIN_SESSION);

    expect(run(platformAdminGuard)).toBe(true);
    expect(run(workspaceGuard)).toBe('/admin');
    expect(run(guestGuard)).toBe('/admin');
  });

  it('keeps workspace staff out of the console', () => {
    const backend = configure();
    signIn(backend, TEST_SESSION);

    expect(run(platformAdminGuard)).toBe('/app');
    expect(run(workspaceGuard)).toBe(true);
    expect(run(guestGuard)).toBe('/app');
  });

  it('names months in the reader language', () => {
    expect(monthLabel('2026-11-01', 'en')).toBe('Nov 2026');
    expect(monthLabel('2026-01-01', 'en')).toBe('Jan 2026');
  });
});

const METRICS: PlatformMetrics = {
  overview: {
    workspaces: 12,
    activeWorkspaces: 11,
    suspendedWorkspaces: 1,
    payingWorkspaces: 4,
    mrrCents: 25600,
    currency: 'USD',
    signupsLast30Days: 3,
    plans: [
      { planCode: 'free', planName: 'Free', workspaces: 7, mrrCents: 0 },
      { planCode: 'pro', planName: 'Pro', workspaces: 2, mrrCents: 5800 },
      { planCode: 'business', planName: 'Business', workspaces: 2, mrrCents: 19800 },
    ],
  },
  mrr: [
    { month: '2026-10-01', value: 12800 },
    { month: '2026-11-01', value: 25600 },
  ],
  signups: [
    { month: '2026-10-01', value: 5 },
    { month: '2026-11-01', value: 3 },
  ],
};

describe('AdminOverview', () => {
  it('shows revenue, paying workspaces and the plan breakdown', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(AdminOverview);
    await fixture.whenStable();
    backend.expectOne('/api/v1/admin/metrics?months=12').flush(METRICS);
    fixture.detectChanges();
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(text).toContain('$256');
    expect(text).toContain('$64 per paying workspace');
    expect(text).toContain('11 active, 1 suspended');
    const rows = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.plans tbody tr'),
    ].map((row) => [...row.children].map((cell) => cell.textContent?.trim()).join(' '));
    expect(rows).toEqual(['Free 7 $0', 'Pro 2 $58', 'Business 2 $198']);
    backend.verify();
  });
});

const DETAIL: AdminTenantDetail = {
  id: 'tenant-1',
  name: 'Acme Support',
  slug: 'acme',
  status: 'Active',
  suspendedAt: null,
  suspensionReason: null,
  timezone: 'Europe/London',
  defaultLanguage: 'en',
  onboardingCompleted: true,
  createdAt: '2026-01-01T00:00:00Z',
  planCode: 'pro',
  planName: 'Pro',
  monthlyPriceCents: 2900,
  currentPeriodEnd: '2026-12-01T00:00:00Z',
  usage: {
    agents: 3,
    maxAgents: 10,
    ticketsThisMonth: 40,
    maxTicketsPerMonth: 1000,
    storageBytes: 0,
    maxStorageBytes: 1024,
    automationRules: 1,
    maxAutomationRules: null,
    activeApiKeys: 0,
    webhooks: 0,
  },
  totals: {
    tickets: 120,
    openTickets: 8,
    customers: 60,
    kbArticles: 4,
    lastTicketActivityAt: null,
  },
  admins: [
    {
      fullName: 'Olivia Owner',
      email: 'olivia@acme.test',
      role: 'Owner',
      isActive: true,
      lastLoginAt: null,
    },
  ],
  recentInvoices: [],
};

describe('AdminTenantDetailPage', () => {
  it('shows usage against limits and the suspension state', async () => {
    const backend = configure();
    const fixture = TestBed.createComponent(AdminTenantDetailPage);
    fixture.componentRef.setInput('id', 'tenant-1');
    fixture.detectChanges();
    await fixture.whenStable();
    backend.expectOne('/api/v1/admin/tenants/tenant-1').flush({
      ...DETAIL,
      status: 'Suspended',
      suspendedAt: '2026-11-10T00:00:00Z',
      suspensionReason: 'Chargeback',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('3 of 10');
    expect(element.textContent).toContain('Reason: Chargeback');
    expect(element.textContent).toContain('read-only overview');
    expect(element.textContent).toContain('Reactivate');
    expect(element.textContent).not.toContain('Suspend workspace');
    backend.verify();
  });
});
