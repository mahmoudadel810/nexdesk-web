import { splitLinks } from './links';

describe('splitLinks', () => {
  it('turns web addresses into links and keeps the text around them', () => {
    expect(
      splitLinks(
        'Download an invoice: https://nexdesk.app/portal/brightpath/kb/download-an-invoice .',
      ),
    ).toEqual([
      { text: 'Download an invoice: ', url: null },
      {
        text: 'https://nexdesk.app/portal/brightpath/kb/download-an-invoice',
        url: 'https://nexdesk.app/portal/brightpath/kb/download-an-invoice',
      },
      { text: ' .', url: null },
    ]);
  });

  it('leaves sentence punctuation outside the address', () => {
    expect(splitLinks('See (http://x.test/a?b=1).')).toEqual([
      { text: 'See (', url: null },
      { text: 'http://x.test/a?b=1', url: 'http://x.test/a?b=1' },
      { text: ').', url: null },
    ]);
  });

  it('links only web addresses', () => {
    expect(splitLinks('javascript:alert(1) data:text/html,x ftp://x.test')).toEqual([
      { text: 'javascript:alert(1) data:text/html,x ftp://x.test', url: null },
    ]);
    expect(splitLinks('no links here')).toEqual([{ text: 'no links here', url: null }]);
    expect(splitLinks('')).toEqual([]);
  });

  it('keeps every character of the message', () => {
    const text = 'a https://x.test/1, b http://y.test/2\nc';
    expect(
      splitLinks(text)
        .map((part) => part.text)
        .join(''),
    ).toBe(text);
  });
});
