import { TicketSla } from '../core/api/tickets.api';
import { formatDuration } from '../features/settings/sla-settings';
import { mostUrgent, slaLines } from './sla-status';

describe('slaLines', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const base: TicketSla = {
    firstResponseDueAt: '2026-11-17T12:30:00Z',
    firstResponseBreached: false,
    firstResponseMet: false,
    resolutionDueAt: '2026-11-18T12:00:00Z',
    resolutionBreached: false,
    isPaused: false,
    isEscalated: false,
  };

  it('flags a deadline within the hour as due soon and a later one as on track', () => {
    expect(slaLines(base, 'Open', now)).toEqual([
      { metric: 'firstResponse', state: 'soon', dueAt: base.firstResponseDueAt },
      { metric: 'resolution', state: 'ok', dueAt: base.resolutionDueAt },
    ]);
  });

  it('treats a passed deadline as overdue even before the server records the breach', () => {
    const lines = slaLines({ ...base, firstResponseDueAt: '2026-11-17T11:00:00Z' }, 'Open', now);

    expect(lines[0].state).toBe('breached');
  });

  it('shows a met first response and a paused resolution clock', () => {
    const lines = slaLines(
      { ...base, firstResponseMet: true, resolutionDueAt: null, isPaused: true },
      'Pending',
      now,
    );

    expect(lines.map((line) => line.state)).toEqual(['met', 'paused']);
  });

  it('keeps a recorded breach even after the reply arrived', () => {
    const lines = slaLines({ ...base, firstResponseBreached: true }, 'Open', now);

    expect(lines[0].state).toBe('breached');
  });

  it('shows nothing for closed tickets or tickets without a policy', () => {
    expect(slaLines(base, 'Closed', now)).toEqual([]);
    expect(
      slaLines({ ...base, firstResponseDueAt: null, resolutionDueAt: null }, 'Open', now),
    ).toEqual([]);
  });

  it('picks the line that needs attention first', () => {
    const lines = slaLines(
      { ...base, firstResponseMet: true, resolutionBreached: true },
      'Open',
      now,
    );

    expect(mostUrgent(lines)?.metric).toBe('resolution');
    expect(mostUrgent([])).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats working minutes as hours and minutes', () => {
    expect(formatDuration(30, 'h', 'min')).toBe('30 min');
    expect(formatDuration(240, 'h', 'min')).toBe('4 h');
    expect(formatDuration(270, 'h', 'min')).toBe('4 h 30 min');
    expect(formatDuration(0, 'h', 'min')).toBe('0 min');
  });
});
