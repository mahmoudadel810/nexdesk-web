import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, forkJoin, of, switchMap } from 'rxjs';
import { BillingApi } from '../../core/api/billing.api';
import {
  ApiKey,
  DeveloperApi,
  IssuedApiKey,
  WebhookEndpoint,
  isKeyActive,
} from '../../core/api/developer.api';
import { environment } from '../../../environments/environment';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { ApiKeyDialog } from './api-key-dialog';
import { SecretDialog, SecretDialogData } from './secret-reveal';
import { WebhookDeliveriesDialog } from './webhook-deliveries-dialog';
import { WebhookDialog } from './webhook-dialog';

@Component({
  selector: 'app-developers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'developers.title' | transloco }}</h1>
        <p>{{ 'developers.subtitle' | transloco }}</p>
      </div>
      <a mat-button [href]="docsUrl" target="_blank" rel="noopener">
        <mat-icon aria-hidden="true">menu_book</mat-icon>
        {{ 'developers.docs' | transloco }}
      </a>
    </header>

    @if (apiAccess() === false) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">lock</mat-icon>
        <h2>{{ 'developers.upgradeTitle' | transloco }}</h2>
        <p>{{ 'developers.upgradeBody' | transloco }}</p>
        <a mat-flat-button routerLink="/app/settings/billing">{{
          'billing.viewPlans' | transloco
        }}</a>
      </div>
    } @else if (apiAccess()) {
      <section aria-labelledby="keys-heading">
        <div class="section-head">
          <div>
            <h2 id="keys-heading">{{ 'developers.keys.title' | transloco }}</h2>
            <p>
              {{ 'developers.keys.subtitle' | transloco }}
              <code dir="ltr">X-Api-Key</code>
            </p>
          </div>
          <button mat-flat-button type="button" (click)="issueKey()">
            <mat-icon aria-hidden="true">add</mat-icon>
            {{ 'developers.keys.new' | transloco }}
          </button>
        </div>

        @if (keys().length === 0) {
          <p class="none">{{ 'developers.keys.empty' | transloco }}</p>
        } @else {
          <ul class="keys">
            @for (key of keys(); track key.id) {
              <li [class.inactive]="!active(key)">
                <div class="key-main">
                  <div class="key-name">
                    <strong>{{ key.name }}</strong>
                    <span class="badge" [class.muted]="!active(key)">{{
                      keyState(key) | transloco
                    }}</span>
                  </div>
                  <code dir="ltr">{{ key.hint }}</code>
                  <div class="scopes">
                    @for (scope of key.scopes; track scope) {
                      <span class="scope" dir="ltr">{{ scope }}</span>
                    }
                  </div>
                </div>
                <dl class="key-facts">
                  <div>
                    <dt>{{ 'developers.keys.created' | transloco }}</dt>
                    <dd>{{ key.createdAt | localDate: 'date' }}</dd>
                  </div>
                  <div>
                    <dt>{{ 'developers.keys.lastUsed' | transloco }}</dt>
                    <dd>
                      {{
                        key.lastUsedAt
                          ? (key.lastUsedAt | localDate: 'relative')
                          : ('developers.keys.neverUsed' | transloco)
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ 'developers.keys.expires' | transloco }}</dt>
                    <dd>
                      {{
                        key.expiresAt
                          ? (key.expiresAt | localDate: 'date')
                          : ('developers.keys.never' | transloco)
                      }}
                    </dd>
                  </div>
                </dl>
                @if (key.revokedAt === null) {
                  <button mat-button type="button" class="danger" (click)="revoke(key)">
                    {{ 'developers.keys.revoke' | transloco }}
                  </button>
                }
              </li>
            }
          </ul>
        }
      </section>

      <section aria-labelledby="webhooks-heading">
        <div class="section-head">
          <div>
            <h2 id="webhooks-heading">{{ 'developers.webhooks.title' | transloco }}</h2>
            <p>{{ 'developers.webhooks.subtitle' | transloco }}</p>
          </div>
          <button mat-flat-button type="button" (click)="addWebhook()">
            <mat-icon aria-hidden="true">add</mat-icon>
            {{ 'developers.webhooks.add' | transloco }}
          </button>
        </div>

        @if (webhooks().length === 0) {
          <p class="none">{{ 'developers.webhooks.empty' | transloco }}</p>
        }
        <div class="webhooks">
          @for (endpoint of webhooks(); track endpoint.id) {
            <mat-card appearance="outlined" [class.off]="!endpoint.isEnabled">
              <mat-card-header>
                <mat-card-title class="url" dir="ltr">{{ endpoint.url }}</mat-card-title>
                @if (endpoint.description) {
                  <mat-card-subtitle>{{ endpoint.description }}</mat-card-subtitle>
                }
              </mat-card-header>
              <mat-card-content>
                <div class="scopes">
                  @for (event of endpoint.events; track event) {
                    <span class="scope" dir="ltr">{{ event }}</span>
                  }
                </div>
              </mat-card-content>
              <mat-card-actions>
                <mat-slide-toggle
                  [checked]="endpoint.isEnabled"
                  [attr.aria-label]="
                    'developers.webhooks.enabledLabel' | transloco: { url: endpoint.url }
                  "
                  (change)="setEnabled(endpoint, $event.checked)"
                >
                  {{ (endpoint.isEnabled ? 'automation.on' : 'automation.off') | transloco }}
                </mat-slide-toggle>
                <span class="spacer"></span>
                <button mat-button type="button" (click)="showDeliveries(endpoint)">
                  {{ 'developers.webhooks.deliveries' | transloco }}
                </button>
                <button
                  mat-icon-button
                  type="button"
                  [matMenuTriggerFor]="more"
                  [attr.aria-label]="'common.actions' | transloco"
                >
                  <mat-icon aria-hidden="true">more_vert</mat-icon>
                </button>
                <mat-menu #more="matMenu">
                  <button mat-menu-item type="button" (click)="ping(endpoint)">
                    <mat-icon aria-hidden="true">send</mat-icon>
                    {{ 'developers.webhooks.ping' | transloco }}
                  </button>
                  <button mat-menu-item type="button" (click)="editWebhook(endpoint)">
                    <mat-icon aria-hidden="true">edit</mat-icon>
                    {{ 'common.edit' | transloco }}
                  </button>
                  <button mat-menu-item type="button" (click)="rotate(endpoint)">
                    <mat-icon aria-hidden="true">autorenew</mat-icon>
                    {{ 'developers.webhooks.rotate' | transloco }}
                  </button>
                  <button mat-menu-item type="button" (click)="removeWebhook(endpoint)">
                    <mat-icon aria-hidden="true">delete</mat-icon>
                    {{ 'common.delete' | transloco }}
                  </button>
                </mat-menu>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      </section>
    }
  `,
  styles: `
    section {
      max-inline-size: 960px;
      margin-block-end: 40px;
    }

    .section-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      margin-block-end: 16px;
    }

    .section-head h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }

    .section-head p,
    .none {
      margin: 4px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9em;
    }

    .keys {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .keys li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 24px;
      padding: 16px;
    }

    .keys li + li {
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }

    .keys li.inactive .key-main {
      opacity: 0.6;
    }

    .key-main {
      display: grid;
      gap: 4px;
      flex: 1 1 260px;
      min-inline-size: 0;
    }

    .key-name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .key-facts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;
      margin: 0;
    }

    .key-facts dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-small);
    }

    .key-facts dd {
      margin: 0;
    }

    .scopes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .scope {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-small);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .danger {
      color: var(--mat-sys-error);
    }

    .webhooks {
      display: grid;
      gap: 16px;
    }

    .url {
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 1rem;
    }

    .off mat-card-title,
    .off mat-card-subtitle,
    .off .scopes {
      opacity: 0.6;
    }

    mat-card-content {
      padding-block-start: 12px;
    }

    mat-card-actions {
      flex-wrap: wrap;
      gap: 4px;
      padding-inline: 16px;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `,
})
export class Developers {
  private readonly api = inject(DeveloperApi);
  private readonly billing = inject(BillingApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly notifier = inject(Notifier);

  protected readonly docsUrl = `${environment.apiUrl.replace(/\/api\/v1\/?$/, '')}/docs`;
  protected readonly apiAccess = signal<boolean | null>(null);
  protected readonly keys = signal<readonly ApiKey[]>([]);
  protected readonly webhooks = signal<readonly WebhookEndpoint[]>([]);

  constructor() {
    this.billing
      .usage()
      .pipe(
        switchMap((usage) => {
          this.apiAccess.set(usage.apiAccess);
          return usage.apiAccess
            ? forkJoin({ keys: this.api.keys(), webhooks: this.api.webhooks() })
            : of(null);
        }),
      )
      .subscribe((loaded) => {
        if (loaded) {
          this.keys.set(loaded.keys);
          this.webhooks.set(loaded.webhooks);
        }
      });
  }

  protected active(key: ApiKey): boolean {
    return isKeyActive(key);
  }

  protected keyState(key: ApiKey): string {
    if (key.revokedAt) {
      return 'developers.keys.revoked';
    }

    return isKeyActive(key) ? 'developers.keys.active' : 'developers.keys.expired';
  }

  protected issueKey(): void {
    this.dialog
      .open<ApiKeyDialog, unknown, IssuedApiKey>(ApiKeyDialog, { width: '560px' })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.loadKeys());
  }

  protected revoke(key: ApiKey): void {
    this.confirm
      .ask({
        title: this.notifier.translate('developers.keys.revokeTitle', { name: key.name }),
        message: this.notifier.translate('developers.keys.revokeBody'),
        confirmLabel: this.notifier.translate('developers.keys.revoke'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.revokeKey(key.id)),
      )
      .subscribe(() => {
        this.notifier.success('developers.keys.revokedDone');
        this.loadKeys();
      });
  }

  protected addWebhook(): void {
    this.dialog
      .open<WebhookDialog, null, WebhookEndpoint>(WebhookDialog, { width: '600px', data: null })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.loadWebhooks());
  }

  protected editWebhook(endpoint: WebhookEndpoint): void {
    this.dialog
      .open<WebhookDialog, WebhookEndpoint, WebhookEndpoint>(WebhookDialog, {
        width: '600px',
        data: endpoint,
      })
      .afterClosed()
      .pipe(filter(Boolean))
      .subscribe((saved) => this.replace(saved));
  }

  protected setEnabled(endpoint: WebhookEndpoint, isEnabled: boolean): void {
    this.api.setWebhookEnabled(endpoint, isEnabled).subscribe({
      next: (saved) => this.replace(saved),
      error: () => this.loadWebhooks(),
    });
  }

  protected showDeliveries(endpoint: WebhookEndpoint): void {
    this.dialog.open(WebhookDeliveriesDialog, {
      data: endpoint,
      width: '760px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'wide-dialog',
    });
  }

  protected ping(endpoint: WebhookEndpoint): void {
    this.api.ping(endpoint.id).subscribe(() => {
      this.notifier.success('developers.webhooks.pinged');
      this.showDeliveries(endpoint);
    });
  }

  protected rotate(endpoint: WebhookEndpoint): void {
    this.confirm
      .ask({
        title: this.notifier.translate('developers.webhooks.rotateTitle'),
        message: this.notifier.translate('developers.webhooks.rotateBody'),
        confirmLabel: this.notifier.translate('developers.webhooks.rotate'),
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.rotateSecret(endpoint.id)),
      )
      .subscribe((rotated) =>
        this.dialog.open<SecretDialog, SecretDialogData>(SecretDialog, {
          width: '560px',
          disableClose: true,
          data: {
            title: this.notifier.translate('developers.webhooks.rotatedTitle'),
            lead: this.notifier.translate('developers.webhooks.rotatedLead'),
            secret: rotated.secret,
          },
        }),
      );
  }

  protected removeWebhook(endpoint: WebhookEndpoint): void {
    this.confirm
      .ask({
        title: this.notifier.translate('developers.webhooks.deleteTitle'),
        message: this.notifier.translate('developers.webhooks.deleteBody', { url: endpoint.url }),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteWebhook(endpoint.id)),
      )
      .subscribe(() => {
        this.notifier.success('developers.webhooks.deleted');
        this.loadWebhooks();
      });
  }

  private replace(saved: WebhookEndpoint): void {
    this.webhooks.update((all) => all.map((e) => (e.id === saved.id ? saved : e)));
  }

  private loadKeys(): void {
    this.api.keys().subscribe((keys) => this.keys.set(keys));
  }

  private loadWebhooks(): void {
    this.api.webhooks().subscribe((webhooks) => this.webhooks.set(webhooks));
  }
}
