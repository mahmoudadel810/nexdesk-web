/** The "@na" being typed just before the caret, if any. `start` is where its "@" is. */
export interface MentionQuery {
  readonly start: number;
  readonly query: string;
}

export interface MentionPart {
  readonly text: string;
  readonly mention: boolean;
}

const isWordChar = (char: string | undefined) => !!char && /[\p{L}\p{N}]/u.test(char);

export function mentionQuery(text: string, caret: number): MentionQuery | null {
  const match = /(?:^|[^\p{L}\p{N}@])@([\p{L}\p{N}.'-]*(?: [\p{L}\p{N}.'-]*)?)$/u.exec(
    text.slice(0, caret),
  );
  return match ? { start: caret - match[1].length - 1, query: match[1] } : null;
}

/** People whose full name, or any word of it, starts with what was typed. */
export function mentionCandidates<T extends { readonly fullName: string }>(
  people: readonly T[],
  query: string,
  limit = 6,
): T[] {
  const typed = query.trim().toLocaleLowerCase();
  return people
    .filter((person) => {
      const name = person.fullName.toLocaleLowerCase();
      return (
        !typed || name.startsWith(typed) || name.split(/\s+/).some((word) => word.startsWith(typed))
      );
    })
    .slice(0, limit);
}

/** Replaces the query with "@Full Name " and says where the caret goes next. */
export function insertMention(
  text: string,
  query: MentionQuery,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const mention = `@${name} `;
  const rest = text.slice(caret).replace(/^ /, '');
  return { text: text.slice(0, query.start) + mention + rest, caret: query.start + mention.length };
}

/**
 * Splits a message into plain text and "@Full Name" mentions of the given people, matching the way the server
 * reads them: whole names only, longest first, ignoring case.
 */
export function splitMentions(body: string, names: readonly string[]): MentionPart[] {
  const lower = body.toLocaleLowerCase();
  const ranges: [number, number][] = [];
  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )) {
    const token = `@${name}`.toLocaleLowerCase();
    for (let at = lower.indexOf(token); at >= 0; at = lower.indexOf(token, at + 1)) {
      const end = at + token.length;
      const free = !ranges.some(([from, to]) => at < to && end > from);
      if (free && !isWordChar(body[at - 1]) && !isWordChar(body[end])) {
        ranges.push([at, end]);
      }
    }
  }

  const parts: MentionPart[] = [];
  let cursor = 0;
  for (const [from, to] of ranges.sort((a, b) => a[0] - b[0])) {
    if (from > cursor) {
      parts.push({ text: body.slice(cursor, from), mention: false });
    }
    parts.push({ text: body.slice(from, to), mention: true });
    cursor = to;
  }
  if (cursor < body.length) {
    parts.push({ text: body.slice(cursor), mention: false });
  }
  return parts;
}
