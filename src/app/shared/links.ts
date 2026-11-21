export interface LinkPart {
  readonly text: string;
  /** Set when the part is a web address to open. */
  readonly url: string | null;
}

/** Only web addresses become links, so a message can never carry a javascript: or data: link. */
const WEB_ADDRESS = /https?:\/\/[^\s<>"']+/gi;

/** Punctuation that ends a sentence rather than the address, as in "see https://example.com/help." */
const TRAILING = /[.,;:!?)\]}]+$/;

/** Splits plain message text into text and web addresses, in order, without losing a character. */
export function splitLinks(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(WEB_ADDRESS)) {
    const url = match[0].replace(TRAILING, '');
    if (!url.includes('://') || url.endsWith('://')) {
      continue;
    }

    const at = match.index;
    if (at > cursor) {
      parts.push({ text: text.slice(cursor, at), url: null });
    }
    parts.push({ text: url, url });
    cursor = at + url.length;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), url: null });
  }
  return parts;
}
