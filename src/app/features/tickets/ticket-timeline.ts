import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Attachment, TicketsApi, TimelineItem } from '../../core/api/tickets.api';
import { FileSizePipe } from '../../shared/file-size.pipe';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { splitLinks } from '../../shared/links';
import { MentionPart, splitMentions } from '../../shared/mentions';

type BodyPart = MentionPart & { readonly url: string | null };

const TRANSLATED_VALUES: Partial<Record<string, string>> = {
  SlaBreached: 'sla.metricNames',
  StatusChanged: 'ticketStatus',
  PriorityChanged: 'ticketPriority',
  TypeChanged: 'ticketType',
};

/** The conversation and change history of a ticket, oldest first. */
@Component({
  selector: 'app-ticket-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileSizePipe, LocalDatePipe, MatIconModule, TranslocoPipe],
  template: `
    <ol class="timeline" [attr.aria-label]="'tickets.timeline.label' | transloco">
      @for (item of items(); track item.id) {
        @if (item.kind === 'Message') {
          <li
            class="message"
            [class.internal]="item.isInternal"
            [class.staff]="item.actor.type === 'Staff'"
          >
            <header>
              <strong>{{ actorName(item) }}</strong>
              @if (item.isInternal) {
                <span class="note-badge">
                  <mat-icon aria-hidden="true">lock</mat-icon>
                  {{ 'tickets.timeline.internalNote' | transloco }}
                </span>
              }
              <time [attr.datetime]="item.createdAt" [title]="item.createdAt | localDate">
                {{ item.createdAt | localDate: 'relative' }}
              </time>
            </header>
            <p class="body" dir="auto">
              @for (part of parts(item.body); track $index) {
                @if (part.url) {
                  <a [href]="part.url" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
                } @else {
                  <span [class.mention]="part.mention">{{ part.text }}</span>
                }
              }
            </p>
            @if (item.attachments.length > 0) {
              <ul class="attachments" [attr.aria-label]="'tickets.attachments.title' | transloco">
                @for (attachment of item.attachments; track attachment.id) {
                  <li>
                    <button type="button" class="attachment" (click)="download(attachment)">
                      <mat-icon aria-hidden="true">download</mat-icon>
                      <span>{{ attachment.fileName }}</span>
                      <span class="size">{{ attachment.sizeBytes | fileSize }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
          </li>
        } @else {
          <li class="event">
            <mat-icon aria-hidden="true">{{ icon(item) }}</mat-icon>
            <span>{{ describe(item) }}</span>
            <time [attr.datetime]="item.createdAt" [title]="item.createdAt | localDate">
              {{ item.createdAt | localDate: 'relative' }}
            </time>
          </li>
        }
      }
    </ol>
  `,
  styles: `
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }

    .message {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container-lowest);
    }

    .message.staff {
      background: var(--mat-sys-surface-container-low);
    }

    .message.internal {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      border-color: transparent;
    }

    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: 8px;
    }

    time {
      margin-inline-start: auto;
      font: var(--mat-sys-body-small);
      opacity: 0.8;
    }

    .note-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-label-medium);
    }

    .note-badge mat-icon,
    .event mat-icon {
      font-size: 16px;
      inline-size: 16px;
      block-size: 16px;
    }

    .body {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      text-align: start;
    }

    .mention {
      padding-inline: 2px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-primary);
      font-weight: 500;
    }

    .internal .mention {
      color: inherit;
      background: color-mix(in srgb, currentColor 14%, transparent);
    }

    .attachments {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .attachment {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px 4px 8px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 16px;
      background: transparent;
      color: inherit;
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }

    .attachment:hover,
    .attachment:focus-visible {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }

    .attachment:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .size {
      opacity: 0.7;
      font: var(--mat-sys-body-small);
    }

    .event {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-inline: 16px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class TicketTimeline {
  private readonly api = inject(TicketsApi);
  private readonly transloco = inject(TranslocoService);

  readonly items = input.required<readonly TimelineItem[]>();
  /** Names of the team members whose "@Full Name" is highlighted. */
  readonly mentionable = input<readonly string[]>([]);

  /** Mentions are highlighted, and web addresses in the rest of the text open as links. */
  protected parts(body: string | null): BodyPart[] {
    return (body ? splitMentions(body, this.mentionable()) : []).flatMap((part): BodyPart[] =>
      part.mention
        ? [{ ...part, url: null }]
        : splitLinks(part.text).map((link) => ({ ...link, mention: false })),
    );
  }

  protected actorName(item: TimelineItem): string {
    return (
      item.actor.name ?? this.transloco.translate(`tickets.timeline.actors.${item.actor.type}`)
    );
  }

  protected icon(item: TimelineItem): string {
    switch (item.eventType) {
      case 'Created':
        return 'add_circle';
      case 'AssigneeChanged':
        return 'person';
      case 'TeamChanged':
        return 'diversity_3';
      case 'TagsChanged':
        return 'sell';
      case 'MergedInto':
      case 'MergedFrom':
        return 'merge';
      case 'SlaBreached':
        return 'error';
      case 'CsatSubmitted':
        return 'star';
      default:
        return 'edit';
    }
  }

  protected describe(item: TimelineItem): string {
    const prefix = item.eventType ? TRANSLATED_VALUES[item.eventType] : undefined;
    const value = (raw: string | null) =>
      raw ? (prefix ? this.transloco.translate(`${prefix}.${raw}`) : raw) : null;
    const none = this.transloco.translate('tickets.timeline.none');
    return this.transloco.translate(`tickets.timeline.events.${item.eventType}`, {
      actor: this.actorName(item),
      field: item.field ?? '',
      from: value(item.oldValue) ?? none,
      to: value(item.newValue) ?? none,
    });
  }

  protected download(attachment: Attachment): void {
    this.api.download(attachment.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
