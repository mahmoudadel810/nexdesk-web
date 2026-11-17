import { insertMention, mentionCandidates, mentionQuery, splitMentions } from './mentions';

describe('mentions', () => {
  it('finds the name being typed after an at sign', () => {
    expect(mentionQuery('Hi @ma', 6)).toEqual({ start: 3, query: 'ma' });
    expect(mentionQuery('@Maya Pa', 8)).toEqual({ start: 0, query: 'Maya Pa' });
    expect(mentionQuery('(@', 2)).toEqual({ start: 1, query: '' });
    expect(mentionQuery('mail me@home', 12)).toBeNull();
    expect(mentionQuery('@a b c', 6)).toBeNull();
    expect(mentionQuery('no mention', 10)).toBeNull();
  });

  it('suggests people by the start of any of their names', () => {
    const people = [
      { fullName: 'Maya Patel' },
      { fullName: 'Tom Reed' },
      { fullName: 'Omar Haddad' },
    ];
    expect(mentionCandidates(people, 'pa').map((p) => p.fullName)).toEqual(['Maya Patel']);
    expect(mentionCandidates(people, 'om').map((p) => p.fullName)).toEqual(['Omar Haddad']);
    expect(mentionCandidates(people, '', 2)).toHaveLength(2);
  });

  it('replaces the typed query with the full name and moves the caret after it', () => {
    const query = mentionQuery('Ask @ma about it', 7)!;
    expect(insertMention('Ask @ma about it', query, 7, 'Maya Patel')).toEqual({
      text: 'Ask @Maya Patel about it',
      caret: 16,
    });
  });

  it('splits a message into text and whole-name mentions', () => {
    expect(splitMentions('cc @ann lee, @Ann and me@ann', ['Ann', 'Ann Lee'])).toEqual([
      { text: 'cc ', mention: false },
      { text: '@ann lee', mention: true },
      { text: ', ', mention: false },
      { text: '@Ann', mention: true },
      { text: ' and me@ann', mention: false },
    ]);
    expect(splitMentions('@Annie', ['Ann'])).toEqual([{ text: '@Annie', mention: false }]);
  });
});
