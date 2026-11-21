/** The customer portal's page for a published article, which opens without signing in. */
export function articleUrl(origin: string, tenantSlug: string, articleSlug: string): string {
  return `${origin.replace(/\/+$/, '')}/portal/${encodeURIComponent(tenantSlug)}/kb/${encodeURIComponent(articleSlug)}`;
}

/**
 * Puts "Title: link" at the caret, with a space on either side where it would otherwise touch a word, and
 * returns the new text and where the caret goes (right after the link).
 */
export function insertArticleLink(
  text: string,
  caret: number,
  title: string,
  url: string,
): { text: string; caret: number } {
  const at = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^\s/.test(after) ? ' ' : '';
  const link = `${lead}${title}: ${url}`;
  return { text: `${before}${link}${trail}${after}`, caret: before.length + link.length };
}
