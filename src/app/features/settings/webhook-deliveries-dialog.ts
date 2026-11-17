import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  DeveloperApi,
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEndpoint,
} from '../../core/api/developer.api';
import { Notifier } from '../../core/ui/notifier';
import { LocalDatePipe } from '../../shared/local-date.pipe';

const STATUS_ICONS: Record<WebhookDeliveryStatus, string> = {
  Succeeded: 'check_circle',
  Pending: 'schedule',
  Failed: 'error',
};

/** A pending delivery that was never tried is queued, not waiting to retry. */
export function deliveryState(delivery: WebhookDelivery): WebhookDeliveryStatus | 'Queued' {
  return delivery.status === 'Pending' && delivery.attempts === 0 ? 'Queued' : delivery.status;
}

/** Pretty-prints a stored payload for reading; shows it as it is when it is not JSON. */
export function formatPayload(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

@Component({
  selector: 'app-webhook-deliveries-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'developers.deliveries.title' | transloco }}</h2>
    <mat-dialog-content>
      <p class="dialog-lead url" dir="ltr">{{ endpoint.url }}</p>
      @if (loaded() && deliveries().length === 0) {
        <p class="dialog-lead">{{ 'developers.deliveries.empty' | transloco }}</p>
      }
      <mat-accordion multi>
        @for (delivery of deliveries(); track delivery.id) {
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon [class]="'status ' + delivery.status" aria-hidden="true">{{
                  icons[delivery.status]
                }}</mat-icon>
                <span class="event" dir="ltr">{{ delivery.event }}</span>
              </mat-panel-title>
              <mat-panel-description>
                <span>{{ 'developers.deliveries.status.' + stateOf(delivery) | transloco }}</span>
                @if (delivery.responseStatus !== null) {
                  <span class="code" dir="ltr">HTTP {{ delivery.responseStatus }}</span>
                }
                <span>{{ delivery.createdAt | localDate: 'relative' }}</span>
              </mat-panel-description>
            </mat-expansion-panel-header>

            <dl class="facts">
              <div>
                <dt>{{ 'developers.deliveries.attempts' | transloco }}</dt>
                <dd>{{ delivery.attempts }}</dd>
              </div>
              @if (delivery.lastAttemptAt) {
                <div>
                  <dt>{{ 'developers.deliveries.lastAttempt' | transloco }}</dt>
                  <dd>
                    {{ delivery.lastAttemptAt | localDate }}
                    @if (delivery.durationMs !== null) {
                      ({{ 'developers.deliveries.took' | transloco: { ms: delivery.durationMs } }})
                    }
                  </dd>
                </div>
              }
              @if (
                delivery.nextAttemptAt && delivery.status === 'Pending' && delivery.attempts > 0
              ) {
                <div>
                  <dt>{{ 'developers.deliveries.nextAttempt' | transloco }}</dt>
                  <dd>{{ delivery.nextAttemptAt | localDate }}</dd>
                </div>
              }
              @if (delivery.resentFromId) {
                <div>
                  <dt>{{ 'developers.deliveries.resent' | transloco }}</dt>
                  <dd>{{ 'developers.deliveries.resentBody' | transloco }}</dd>
                </div>
              }
            </dl>
            @if (delivery.error) {
              <p class="form-alert" role="note">{{ delivery.error }}</p>
            }
            @if (delivery.responseBody) {
              <h3>{{ 'developers.deliveries.response' | transloco }}</h3>
              <pre dir="ltr">{{ delivery.responseBody }}</pre>
            }
            <h3>{{ 'developers.deliveries.payload' | transloco }}</h3>
            <pre dir="ltr">{{ pretty(delivery.payload) }}</pre>
            <div class="actions">
              <button
                mat-stroked-button
                type="button"
                [disabled]="resending() === delivery.id"
                (click)="resend(delivery)"
              >
                <mat-icon aria-hidden="true">replay</mat-icon>
                {{ 'developers.deliveries.resend' | transloco }}
              </button>
            </div>
          </mat-expansion-panel>
        }
      </mat-accordion>
      @if (deliveries().length < total()) {
        <button mat-button type="button" (click)="load()">
          {{ 'developers.deliveries.more' | transloco }}
        </button>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="refresh()">
        {{ 'developers.deliveries.refresh' | transloco }}
      </button>
      <button mat-button type="button" mat-dialog-close>{{ 'common.dismiss' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .url {
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    mat-panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
    }

    mat-panel-description {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px 12px;
    }

    .event {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .status {
      flex: none;
    }

    .status.Succeeded {
      color: var(--mat-sys-tertiary);
    }

    .status.Pending {
      color: var(--mat-sys-on-surface-variant);
    }

    .status.Failed {
      color: var(--mat-sys-error);
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px 16px;
      margin: 0 0 12px;
    }

    .facts dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .facts dd {
      margin: 2px 0 0;
    }

    h3 {
      margin: 12px 0 4px;
      font: var(--mat-sys-title-small);
    }

    pre {
      margin: 0;
      max-block-size: 240px;
      overflow: auto;
      padding: 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high);
      font-size: 0.8em;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      margin-block-start: 12px;
    }

    @media (max-width: 600px) {
      mat-panel-description {
        display: none;
      }
    }
  `,
})
export class WebhookDeliveriesDialog {
  protected readonly endpoint = inject<WebhookEndpoint>(MAT_DIALOG_DATA);
  private readonly api = inject(DeveloperApi);
  private readonly notifier = inject(Notifier);

  protected readonly icons = STATUS_ICONS;
  protected readonly deliveries = signal<readonly WebhookDelivery[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  protected readonly resending = signal<string | null>(null);
  private page = 0;

  constructor() {
    this.load();
  }

  protected stateOf(delivery: WebhookDelivery): string {
    return deliveryState(delivery);
  }

  protected pretty(payload: string): string {
    return formatPayload(payload);
  }

  protected load(): void {
    this.page += 1;
    this.api.deliveries(this.endpoint.id, this.page).subscribe((result) => {
      this.deliveries.update((deliveries) => [...deliveries, ...result.items]);
      this.total.set(result.totalCount);
      this.loaded.set(true);
    });
  }

  protected refresh(): void {
    this.page = 0;
    this.deliveries.set([]);
    this.load();
  }

  protected resend(delivery: WebhookDelivery): void {
    this.resending.set(delivery.id);
    this.api.resend(delivery.id).subscribe({
      next: () => {
        this.resending.set(null);
        this.notifier.success('developers.deliveries.resendQueued');
        this.refresh();
      },
      error: () => this.resending.set(null),
    });
  }
}
