import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppNotification, NotificationsApi } from '../core/api/notifications.api';
import { RealtimeService } from '../core/realtime/realtime.service';
import { Notifier } from '../core/ui/notifier';
import { LocalDatePipe } from '../shared/local-date.pipe';

const SHOWN = 8;

/** Text of a notification in the active language. */
function isSlaNotification(notification: AppNotification): boolean {
  return notification.type === 'SlaWarning' || notification.type === 'SlaBreach';
}

export function describeNotification(
  notification: AppNotification,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string {
  return translate(`notifications.types.${notification.type}`, {
    actor: notification.actorName ?? translate('notifications.someone'),
    number: notification.ticketNumber,
    metric:
      isSlaNotification(notification) && notification.preview
        ? translate(`sla.metricNames.${notification.preview}`)
        : '',
  });
}

@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="panel"
      [matTooltip]="'notifications.title' | transloco"
      [attr.aria-label]="'notifications.open' | transloco: { count: unread() }"
      (menuOpened)="load()"
    >
      <mat-icon
        aria-hidden="true"
        [matBadge]="unread() > 9 ? '9+' : unread()"
        [matBadgeHidden]="unread() === 0"
        matBadgeColor="warn"
        matBadgeSize="small"
        matBadgeDescription=""
      >
        notifications
      </mat-icon>
    </button>
    <mat-menu #panel="matMenu" class="notification-panel" xPosition="before">
      <div class="panel-header" role="presentation">
        <strong>{{ 'notifications.title' | transloco }}</strong>
        @if (unread() > 0) {
          <button mat-button type="button" (click)="markAllRead($event)">
            {{ 'notifications.markAllRead' | transloco }}
          </button>
        }
      </div>
      @for (notification of items(); track notification.id) {
        <button
          mat-menu-item
          type="button"
          class="notification"
          [class.unread]="!notification.isRead"
          (click)="open(notification)"
        >
          <mat-icon aria-hidden="true">{{ icon(notification) }}</mat-icon>
          <span class="text">
            <span class="headline">{{ describe(notification) }}</span>
            <span class="subject">{{ notification.ticketSubject }}</span>
            @if (notification.preview && !isSla(notification)) {
              <span class="preview">{{ notification.preview }}</span>
            }
            <span class="when">{{ notification.createdAt | localDate: 'relative' }}</span>
          </span>
        </button>
      } @empty {
        <p class="empty">{{ 'notifications.empty' | transloco }}</p>
      }
    </mat-menu>
  `,
  styles: `
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 4px 8px 4px 16px;
      min-inline-size: min(360px, 80vw);
    }

    .notification {
      block-size: auto;
      min-block-size: 64px;
      padding-block: 8px;
      align-items: flex-start;
      white-space: normal;
      line-height: 1.35;
    }

    .notification.unread {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .text {
      display: grid;
      gap: 2px;
      max-inline-size: 320px;
      text-align: start;
    }

    .headline {
      font: var(--mat-sys-label-large);
    }

    .subject {
      font: var(--mat-sys-body-medium);
    }

    .preview,
    .when {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .preview {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .empty {
      margin: 0;
      padding: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class NotificationBell {
  private readonly api = inject(NotificationsApi);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  private readonly transloco = inject(TranslocoService);

  protected readonly unread = signal(0);
  protected readonly items = signal<readonly AppNotification[]>([]);

  constructor() {
    this.api.unreadCount().subscribe((result) => this.unread.set(result.count));
    inject(RealtimeService)
      .notifications.pipe(takeUntilDestroyed())
      .subscribe((notification) => {
        this.unread.update((count) => count + 1);
        this.items.update((items) => [notification, ...items].slice(0, SHOWN));
        this.notifier.message(this.describe(notification));
      });
  }

  protected load(): void {
    this.api.list(SHOWN).subscribe((page) => this.items.set(page.items));
  }

  protected describe(notification: AppNotification): string {
    return describeNotification(notification, (key, params) =>
      this.transloco.translate(key, params),
    );
  }

  protected isSla(notification: AppNotification): boolean {
    return isSlaNotification(notification);
  }

  protected icon(notification: AppNotification): string {
    switch (notification.type) {
      case 'TicketAssigned':
        return 'assignment_ind';
      case 'TicketNote':
        return 'lock';
      case 'SlaWarning':
        return 'timer';
      case 'SlaBreach':
        return 'error';
      case 'Automation':
        return 'bolt';
      case 'Mention':
        return 'alternate_email';
      default:
        return 'chat';
    }
  }

  protected open(notification: AppNotification): void {
    if (!notification.isRead) {
      this.api.markRead(notification.id).subscribe((result) => this.unread.set(result.count));
    }

    void this.router.navigate(['/app/tickets', notification.ticketId]);
  }

  protected markAllRead(event: Event): void {
    event.stopPropagation();
    this.api.markAllRead().subscribe((result) => {
      this.unread.set(result.count);
      this.items.update((items) => items.map((item) => ({ ...item, isRead: true })));
    });
  }
}
