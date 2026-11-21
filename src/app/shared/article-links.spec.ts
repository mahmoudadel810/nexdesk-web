import { articleUrl, insertArticleLink } from './article-links';

describe('article links', () => {
  it('points at the customer portal page of the article', () => {
    expect(articleUrl('https://nexdesk.app/', 'brightpath', 'download-an-invoice')).toBe(
      'https://nexdesk.app/portal/brightpath/kb/download-an-invoice',
    );
  });

  it('puts the link at the caret and keeps it apart from the words around it', () => {
    // A full stop straight after the link would be read as part of it.
    expect(insertArticleLink('See this.', 8, 'Invoices', 'https://x/kb/i')).toEqual({
      text: 'See this Invoices: https://x/kb/i .',
      caret: 33,
    });
    expect(insertArticleLink('Hi ', 3, 'Invoices', 'https://x/kb/i')).toEqual({
      text: 'Hi Invoices: https://x/kb/i',
      caret: 27,
    });
    expect(insertArticleLink('', 0, 'Invoices', 'https://x/kb/i').text).toBe(
      'Invoices: https://x/kb/i',
    );
    expect(insertArticleLink('abc', 99, 'T', 'u').text).toBe('abc T: u');
  });
});
