import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../public/i18n/en.json';
import { PortalArticle, PortalHelpBrowser, PortalHelpSuggestions } from './portal-kb';
import { HelpArticle, HelpArticleSummary, PortalService } from './portal.service';

const SUMMARY: HelpArticleSummary = {
  title: 'How to download an invoice',
  slug: 'how-to-download-an-invoice',
  categoryName: 'Billing',
  excerpt: 'Open Billing and choose Download PDF.',
};
const ARTICLE: HelpArticle = {
  id: 'a1',
  title: SUMMARY.title,
  slug: SUMMARY.slug,
  categoryName: 'Billing',
  bodyHtml:
    '<h2>Steps</h2><p>Open <strong>Billing</strong>.</p><script>window.hacked = true</script>',
  publishedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};
const ARTICLES_URL = '/api/v1/portal/acme/kb/articles';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

describe('Help centre articles', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    TestBed.inject(PortalService).info.set({ name: 'Acme', slug: 'acme', defaultLanguage: 'en' });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('groups published articles by category and switches to results while searching', async () => {
    const fixture = TestBed.createComponent(PortalHelpBrowser);
    backend
      .expectOne('/api/v1/portal/acme/kb/categories')
      .flush([{ id: 'c1', name: 'Billing', description: 'Invoices', articleCount: 1 }]);
    backend.expectOne(`${ARTICLES_URL}?limit=100`).flush([SUMMARY]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.groups h3')?.textContent).toContain('Billing');
    expect(element.querySelector('.links a')?.getAttribute('href')).toBe(
      '/portal/acme/kb/how-to-download-an-invoice',
    );

    const search = element.querySelector('input') as HTMLInputElement;
    search.value = ' refund ';
    search.dispatchEvent(new Event('input'));
    await wait(300);
    backend.expectOne(`${ARTICLES_URL}?limit=20&search=refund`).flush([]);
    await fixture.whenStable();

    expect(element.querySelector('.groups')).toBeNull();
    expect(element.textContent).toContain('Nothing matches');
  });

  it('shows nothing when the workspace has not published any article', async () => {
    const fixture = TestBed.createComponent(PortalHelpBrowser);
    backend.expectOne('/api/v1/portal/acme/kb/categories').flush([]);
    backend.expectOne(`${ARTICLES_URL}?limit=100`).flush([]);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
  });

  it('suggests articles only once the customer has typed a few characters', async () => {
    const fixture = TestBed.createComponent(PortalHelpSuggestions);
    fixture.componentRef.setInput('term', 'in');
    await wait(450);
    backend.expectNone(() => true);

    fixture.componentRef.setInput('term', 'invoice');
    await fixture.whenStable();
    await wait(450);
    backend.expectOne(`${ARTICLES_URL}?limit=4&search=invoice`).flush([SUMMARY]);
    await fixture.whenStable();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a');
    expect(link?.textContent).toContain(SUMMARY.title);
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('renders an article without running scripts and records one vote', async () => {
    const fixture = TestBed.createComponent(PortalArticle);
    fixture.componentRef.setInput('articleSlug', SUMMARY.slug);
    await fixture.whenStable();
    backend.expectOne(`${ARTICLES_URL}/${SUMMARY.slug}`).flush(ARTICLE);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.markdown-body strong')?.textContent).toBe('Billing');
    expect(element.querySelector('script')).toBeNull();

    const yes = [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Yes'));
    yes?.click();
    const vote = backend.expectOne(`${ARTICLES_URL}/${SUMMARY.slug}/feedback`);
    expect(vote.request.body).toEqual({ helpful: true });
    vote.flush(null);
    await fixture.whenStable();

    expect(element.textContent).toContain('Thanks for your feedback');
    expect(element.querySelectorAll('.votes button').length).toBe(0);
  });

  it('says so when an article is missing or still a draft', async () => {
    const fixture = TestBed.createComponent(PortalArticle);
    fixture.componentRef.setInput('articleSlug', 'secret-roadmap');
    await fixture.whenStable();
    backend
      .expectOne(`${ARTICLES_URL}/secret-roadmap`)
      .flush({ code: 'kb-article-not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Article not found');
  });
});
