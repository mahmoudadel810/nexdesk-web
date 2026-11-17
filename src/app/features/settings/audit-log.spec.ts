import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { AuditEntry } from '../../core/api/audit.api';
import { AuditLog, dayBoundary, fieldLabel } from './audit-log';

const URL = '/api/v1/audit-logs';
const ENTRY: AuditEntry = {
  id: 'log-1',
  occurredAt: '2026-11-17T09:30:00Z',
  actor: { type: 'Staff', id: 'user-1', name: 'Olivia Owner' },
  entityType: 'user',
  entityId: 'user-2',
  entityLabel: 'Aaron Agent',
  operation: 'Updated',
  changes: [{ field: 'role', before: 'Agent', after: 'Admin' }],
  ipAddress: '203.0.113.7',
};
const BY_INTEGRATION: AuditEntry = {
  ...ENTRY,
  id: 'log-2',
  actor: { type: 'ApiKey', id: 'key-1', name: 'Order sync' },
  entityType: 'ticket',
  entityLabel: '#12 Damaged parcel',
  operation: 'Created',
  changes: [],
};

describe('Audit log helpers', () => {
  it('turns field names into words', () => {
    expect(fieldLabel('role')).toBe('Role');
    expect(fieldLabel('firstResponseMinutes')).toBe('First response minutes');
    expect(fieldLabel('maxAgents2')).toBe('Max agents2');
  });

  it('sends whole local days as instants and ignores malformed dates', () => {
    expect(new Date(dayBoundary('2026-03-01', false)!).getHours()).toBe(0);
    const end = new Date(dayBoundary('2026-03-01', true)!);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([1, 23, 59]);
    expect(dayBoundary('03/01/2026', false)).toBeNull();
  });
});

describe('AuditLog', () => {
  let backend: HttpTestingController;

  async function render(): Promise<{
    element: HTMLElement;
    detect: () => Promise<void>;
    filters: Filters;
  }> {
    TestBed.configureTestingModule({
      imports: [
        AuditLog,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AuditLog);
    await fixture.whenStable();
    return {
      element: fixture.nativeElement as HTMLElement,
      filters: fixture.componentInstance as unknown as Filters,
      detect: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  afterEach(() => backend.verify());

  it('lists entries as sentences with who, what and the values before and after', async () => {
    const { element, detect } = await render();
    const request = backend.expectOne((r) => r.url === URL);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.has('entityType')).toBe(false);
    request.flush({ items: [ENTRY, BY_INTEGRATION], page: 1, pageSize: 25, totalCount: 2 });
    await detect();

    const summaries = [...element.querySelectorAll('.summary')].map((s) => s.textContent?.trim());
    expect(summaries).toEqual([
      'Olivia Owner changed team member Aaron Agent',
      'Order sync (API key) created ticket #12 Damaged parcel',
    ]);
    const cells = [...element.querySelectorAll('.changes tbody tr')][0].textContent;
    expect(cells).toContain('Role');
    expect(cells).toContain('Agent');
    expect(cells).toContain('Admin');
    expect(element.textContent).toContain('203.0.113.7');
  });

  it('asks the API again with the chosen filters and says when nothing matches', async () => {
    const { element, detect, filters } = await render();
    backend
      .expectOne((r) => r.url === URL)
      .flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    await detect();
    expect(element.textContent).toContain('Nothing recorded yet');

    filters.setEntityType('webhook');
    filters.setOperation('Deleted');
    filters.setRange('2026-11-01', '2026-11-17');
    // Each change replaces the request before it; only the newest is answered.
    const requests = backend.match((r) => r.url === URL);
    expect(requests).toHaveLength(3);
    const last = requests[2];
    expect(last.request.params.get('page')).toBe('1');
    expect(last.request.params.get('entityType')).toBe('webhook');
    expect(last.request.params.get('operation')).toBe('Deleted');
    expect(last.request.params.get('to')).toBe(dayBoundary('2026-11-17', true));
    last.flush(EMPTY);
    await detect();

    expect(element.textContent).toContain('No entries match');
    expect(element.textContent).toContain('Clear filters');
  });
});

const EMPTY = { items: [], page: 1, pageSize: 25, totalCount: 0 };

interface Filters {
  setEntityType(type: string | null): void;
  setOperation(operation: string | null): void;
  setRange(from: string, to: string): void;
}
