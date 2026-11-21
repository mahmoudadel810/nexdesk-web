import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { KbArticleListItem } from '../../core/api/kb.api';
import { ArticleLinkDialog } from './article-link-dialog';

const ARTICLE: KbArticleListItem = {
  id: 'article-1',
  title: 'Download an invoice',
  slug: 'download-an-invoice',
  categoryId: 'category-1',
  categoryName: 'Billing and plans',
  status: 'Published',
  publishedAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  viewCount: 12,
  helpfulCount: 3,
  notHelpfulCount: 0,
};

describe('ArticleLinkDialog', () => {
  it('lists published articles, searches them, and closes with the one picked', async () => {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [
        ArticleLinkDialog,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ArticleLinkDialog);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    const first = backend.expectOne((request) => request.url === '/api/v1/kb/articles');
    expect(first.request.params.get('status')).toBe('Published');
    expect(first.request.params.has('search')).toBe(false);
    first.flush({ items: [ARTICLE], page: 1, pageSize: 10, totalCount: 1 });
    await fixture.whenStable();
    expect(element.textContent).toContain('Download an invoice');
    expect(element.textContent).toContain('Billing and plans');

    const search = element.querySelector('input') as HTMLInputElement;
    search.value = 'zzz';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const searched = backend.expectOne((request) => request.url === '/api/v1/kb/articles');
    expect(searched.request.params.get('search')).toBe('zzz');
    expect(searched.request.params.get('status')).toBe('Published');
    searched.flush({ items: [], page: 1, pageSize: 10, totalCount: 0 });
    await fixture.whenStable();
    expect(element.textContent).toContain('No published article matches.');

    search.value = 'invoice';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 300));
    backend
      .expectOne((request) => request.url === '/api/v1/kb/articles')
      .flush({ items: [ARTICLE], page: 1, pageSize: 10, totalCount: 1 });
    await fixture.whenStable();

    (element.querySelector('button[mat-list-item]') as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith(ARTICLE);
    backend.verify();
  });
});
