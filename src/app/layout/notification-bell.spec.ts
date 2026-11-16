import en from '../../../public/i18n/en.json';
import { AppNotification } from '../core/api/notifications.api';
import { describeNotification } from './notification-bell';

describe('describeNotification', () => {
  const translate = (key: string, params: Record<string, unknown> = {}): string => {
    const template = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en) as string;
    return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(params[name] ?? ''));
  };

  const base: AppNotification = {
    id: 'n1',
    type: 'TicketAssigned',
    ticketId: 't1',
    ticketNumber: 42,
    ticketSubject: 'Printer jam',
    actorName: 'Olivia Owner',
    preview: null,
    createdAt: '2026-11-17T09:00:00Z',
    isRead: false,
  };

  it('names the actor and the ticket', () => {
    expect(describeNotification(base, translate)).toBe('Olivia Owner assigned ticket #42 to you');
    expect(describeNotification({ ...base, type: 'TicketReply' }, translate)).toBe(
      'Olivia Owner replied on ticket #42',
    );
  });

  it('falls back to a neutral actor when the author is unknown', () => {
    expect(describeNotification({ ...base, type: 'TicketNote', actorName: null }, translate)).toBe(
      'Someone added a note on ticket #42',
    );
  });

  it('names the SLA clock for deadline alerts', () => {
    expect(
      describeNotification(
        { ...base, type: 'SlaBreach', actorName: null, preview: 'FirstResponse' },
        translate,
      ),
    ).toBe('Ticket #42 missed its first response deadline');
    expect(
      describeNotification(
        { ...base, type: 'SlaWarning', actorName: null, preview: 'Resolution' },
        translate,
      ),
    ).toBe('Ticket #42 is close to its resolution deadline');
  });
});
