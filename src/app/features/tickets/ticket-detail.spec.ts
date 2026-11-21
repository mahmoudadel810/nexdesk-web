import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { EMPTY, of } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import { KbArticleListItem } from '../../core/api/kb.api';
import { TicketDetail as TicketDto } from '../../core/api/tickets.api';
import { TEST_SESSION, authResponse } from '../../core/auth/auth-testing';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ArticleLinkDialog } from './article-link-dialog';
import { TicketDetail } from './ticket-detail';

const TICKET: TicketDto = {
  id: 'ticket-1',
  number: 42,
  subject: 'Cannot download my invoice',
  status: 'Open',
  priority: 'Normal',
  type: 'Question',
  channel: 'Portal',
  requester: { id: 'customer-1', name: 'Casey Customer', email: 'casey@example.test' },
  assignee: null,
  team: null,
  tags: [],
  createdAt: '2026-11-17T09:00:00Z',
  lastActivityAt: '2026-11-17T09:30:00Z',
  sla: {
    firstResponseDueAt: null,
    firstResponseBreached: false,
    firstResponseMet: true,
    resolutionDueAt: null,
    resolutionBreached: false,
    isPaused: false,
    isEscalated: false,
  },
  firstRespondedAt: '2026-11-17T09:10:00Z',
  solvedAt: null,
  closedAt: null,
  watchers: [],
  isWatching: false,
  customFields: {},
  mergedInto: null,
  version: 1,
  csat: null,
};

const ARTICLE: KbArticleListItem = {
  id: 'article-1',
  title: 'Download an invoice',
  slug: 'download-an-invoice',
  categoryId: 'category-1',
  categoryName: 'Billing and plans',
  status: 'Published',
  publishedAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  viewCount: 0,
  helpfulCount: 0,
  notHelpfulCount: 0,
};

describe('TicketDetail composer', () => {
  let backend: HttpTestingController;
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(ARTICLE) })) };

  async function open(permissions: string[]): Promise<ComponentFixture<TicketDetail>> {
    dialog.open.mockClear();
    TestBed.configureTestingModule({
      imports: [
        TicketDetail,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { ticketChanges: EMPTY } },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login('a', 'b').subscribe();
    backend
      .expectOne('/api/v1/auth/login')
      .flush({ ...authResponse(), session: { ...TEST_SESSION, permissions } });

    const fixture = TestBed.createComponent(TicketDetail);
    fixture.componentRef.setInput('id', TICKET.id);
    for (let round = 0; round < 3; round++) {
      await fixture.whenStable();
      for (const request of backend.match(() => true)) {
        const url = request.request.url;
        if (url.endsWith('/timeline') || url.endsWith('/teams') || url.endsWith('/custom-fields')) {
          request.flush([]);
        } else if (url.endsWith('/users')) {
          request.flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
        } else {
          request.flush(TICKET);
        }
      }
    }
    await fixture.whenStable();
    return fixture;
  }

  function insertButton(fixture: ComponentFixture<TicketDetail>): HTMLButtonElement | undefined {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Insert article'),
    );
  }

  it('links the chosen article where the caret was', async () => {
    const fixture = await open(['tickets.view', 'tickets.reply', 'kb.view']);
    const composer = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    composer.value = 'See this.';
    composer.dispatchEvent(new Event('input'));
    composer.setSelectionRange(8, 8);

    insertButton(fixture)!.click();
    await fixture.whenStable();

    expect(dialog.open).toHaveBeenCalledWith(ArticleLinkDialog, expect.anything());
    expect(composer.value).toBe(
      `See this Download an invoice: ${location.origin}/portal/acme-support/kb/download-an-invoice .`,
    );
    expect(composer.selectionStart).toBe(composer.value.length - 2);
  });

  it('offers no article link to someone who may not read the knowledge base', async () => {
    const fixture = await open(['tickets.view', 'tickets.reply']);

    expect((fixture.nativeElement as HTMLElement).querySelector('textarea')).not.toBeNull();
    expect(insertButton(fixture)).toBeUndefined();
  });
});
