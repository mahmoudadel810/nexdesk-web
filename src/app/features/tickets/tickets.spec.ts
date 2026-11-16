import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { TicketListItem, TimelineItem } from '../../core/api/tickets.api';
import { TEST_SESSION, authResponse } from '../../core/auth/auth-testing';
import { AuthService } from '../../core/auth/auth.service';
import { formatFileSize } from '../../shared/file-size.pipe';
import { normalizeTag } from './tag-input';
import { TicketTimeline } from './ticket-timeline';
import { Tickets } from './tickets';

const translations = TranslocoTestingModule.forRoot({
  langs: { en },
  translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
  preloadLangs: true,
});

const TICKET: TicketListItem = {
  id: 'ticket-1',
  number: 42,
  subject: 'Cannot download my invoice',
  status: 'Open',
  priority: 'Urgent',
  type: 'Incident',
  channel: 'Agent',
  requester: { id: 'customer-1', name: 'Casey Customer', email: 'casey@example.test' },
  assignee: null,
  team: null,
  tags: ['billing'],
  createdAt: '2026-11-17T09:00:00Z',
  lastActivityAt: '2026-11-17T09:30:00Z',
};

describe('Tickets', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Tickets, translations],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login('a', 'b').subscribe();
    backend.expectOne('/api/v1/auth/login').flush({
      ...authResponse(),
      session: { ...TEST_SESSION, permissions: ['tickets.view', 'tickets.create'] },
    });
  });

  afterEach(() => backend.verify());

  it('loads unresolved tickets by default and links each one to its page', async () => {
    const fixture = TestBed.createComponent(Tickets);
    await fixture.whenStable();

    const request = backend.expectOne((r) => r.url === '/api/v1/tickets');
    expect(request.request.params.getAll('status')).toEqual(['New', 'Open', 'Pending', 'OnHold']);
    expect(request.request.params.get('sort')).toBe('-lastActivityAt');
    request.flush({ items: [TICKET], page: 1, pageSize: 25, totalCount: 1 });
    backend.expectOne('/api/v1/views').flush([]);
    backend
      .expectOne((r) => r.url === '/api/v1/users')
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    backend.expectOne('/api/v1/teams').flush([]);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const link = element.querySelector<HTMLAnchorElement>('a.subject')!;
    expect(link.textContent).toContain('#42');
    expect(link.textContent).toContain('Cannot download my invoice');
    expect(link.getAttribute('href')).toBe('/app/tickets/ticket-1');
    expect(element.querySelector('.status-badge')?.getAttribute('data-status')).toBe('Open');
    expect(element.querySelector('.priority')?.textContent).toContain(en.ticketPriority.Urgent);
    expect(element.textContent).toContain(en.tickets.unassigned);
    expect(element.textContent).toContain(en.tickets.new.open);
  });

  it('applies a saved view to the filters and reloads', async () => {
    const fixture = TestBed.createComponent(Tickets);
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/v1/tickets')
      .flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    backend.expectOne('/api/v1/views').flush([
      {
        id: 'view-1',
        name: 'Urgent mine',
        isShared: true,
        isMine: false,
        filter: {
          status: ['Open'],
          priority: ['Urgent'],
          assignee: 'me',
          teamId: null,
          tag: null,
          search: 'refund',
          sort: '-priority',
        },
      },
    ]);
    backend
      .expectOne((r) => r.url === '/api/v1/users')
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    backend.expectOne('/api/v1/teams').flush([]);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const chips = [...element.querySelectorAll<HTMLElement>('mat-chip-option')];
    expect(
      chips.map((chip) => chip.textContent?.trim().split(/\s+/).slice(0, 2).join(' ')),
    ).toEqual([en.tickets.views.default, 'Urgent mine']);
    chips[1].querySelector('button')!.click();
    await fixture.whenStable();

    const request = backend.expectOne((r) => r.url === '/api/v1/tickets');
    expect(request.request.params.getAll('status')).toEqual(['Open']);
    expect(request.request.params.getAll('priority')).toEqual(['Urgent']);
    expect(request.request.params.get('assigneeId')).toBe('user-1');
    expect(request.request.params.get('search')).toBe('refund');
    expect(request.request.params.get('sort')).toBe('-priority');
    request.flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });
  });

  it('offers bulk actions only to people who can edit tickets', async () => {
    const fixture = TestBed.createComponent(Tickets);
    await fixture.whenStable();
    backend
      .expectOne((r) => r.url === '/api/v1/tickets')
      .flush({ items: [TICKET], page: 1, pageSize: 25, totalCount: 1 });
    backend.expectOne('/api/v1/views').flush([]);
    backend
      .expectOne((r) => r.url === '/api/v1/users')
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    backend.expectOne('/api/v1/teams').flush([]);
    await fixture.whenStable();

    // The test session has tickets.view and tickets.create but not tickets.edit.
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-checkbox')).toBeNull();
  });

  it('says so when no ticket matches', async () => {
    const fixture = TestBed.createComponent(Tickets);
    await fixture.whenStable();

    backend
      .expectOne((r) => r.url === '/api/v1/tickets')
      .flush({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    backend.expectOne('/api/v1/views').flush([]);
    backend
      .expectOne((r) => r.url === '/api/v1/users')
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    backend.expectOne('/api/v1/teams').flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(en.tickets.empty);
  });
});

describe('TicketTimeline', () => {
  function item(overrides: Partial<TimelineItem>): TimelineItem {
    return {
      id: crypto.randomUUID(),
      kind: 'Event',
      createdAt: '2026-11-17T09:00:00Z',
      actor: { type: 'Staff', id: 'user-1', name: 'Olivia Owner' },
      body: null,
      isInternal: false,
      attachments: [],
      eventType: null,
      field: null,
      oldValue: null,
      newValue: null,
      ...overrides,
    };
  }

  async function render(items: TimelineItem[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [TicketTimeline, translations],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(TicketTimeline);
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('describes changes in words, translating status and priority values', async () => {
    const element = await render([
      item({ eventType: 'StatusChanged', oldValue: 'New', newValue: 'OnHold' }),
      item({ eventType: 'AssigneeChanged', oldValue: null, newValue: 'Aaron Agent' }),
      item({
        eventType: 'StatusChanged',
        oldValue: 'Pending',
        newValue: 'Open',
        actor: { type: 'System', id: null, name: null },
      }),
    ]);

    const events = [...element.querySelectorAll('.event span')].map((e) => e.textContent?.trim());
    expect(events).toEqual([
      'Olivia Owner changed the status from New to On hold',
      'Olivia Owner changed the assignee from none to Aaron Agent',
      'NexDesk changed the status from Pending to Open',
    ]);
  });

  it('marks internal notes and lists attachments of a message', async () => {
    const element = await render([
      item({
        kind: 'Message',
        body: 'Line one\nLine two',
        isInternal: true,
        attachments: [
          { id: 'a1', fileName: 'error.log', contentType: 'text/plain', sizeBytes: 2048 },
        ],
      }),
      item({
        kind: 'Message',
        body: 'Public answer',
        actor: { type: 'Customer', id: 'c1', name: 'Casey Customer' },
      }),
    ]);

    const messages = element.querySelectorAll('.message');
    expect(messages[0].classList.contains('internal')).toBe(true);
    expect(messages[0].textContent).toContain(en.tickets.timeline.internalNote);
    expect(messages[0].querySelector('.body')?.textContent).toBe('Line one\nLine two');
    expect(messages[0].querySelector('.attachment')?.textContent).toContain('error.log');
    expect(messages[0].querySelector('.attachment')?.textContent).toContain('2.0 KB');
    expect(messages[1].classList.contains('internal')).toBe(false);
    expect(messages[1].textContent).not.toContain(en.tickets.timeline.internalNote);
  });
});

describe('ticket helpers', () => {
  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
  });

  it('normalizes tags the way the API does', () => {
    expect(normalizeTag('  Billing ')).toBe('billing');
    expect(normalizeTag('x'.repeat(40)).length).toBe(30);
    expect(normalizeTag('   ')).toBe('');
  });
});
