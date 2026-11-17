import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import { AdminApi, AdminTenantDetail } from '../core/api/admin.api';
import { formatMoney } from '../core/api/billing.api';
import { LanguageService } from '../core/i18n/language.service';
import { Notifier } from '../core/ui/notifier';
import { Confirm } from '../shared/confirm-dialog';
import { LocalDatePipe } from '../shared/local-date.pipe';
import { Prompt } from '../shared/prompt-dialog';
import { toMeters } from '../features/settings/billing';

@Component({
  selector: 'app-admin-tenant-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <a mat-button routerLink="/admin/tenants" class="back">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'admin.tenants.title' | transloco }}
    </a>

    @if (tenant(); as t) {
      <header class="page-header">
        <div>
          <h1>
            {{ t.name }}
            <span class="badge" [class.muted]="t.status === 'Suspended'">{{
              'admin.status.' + t.status | transloco
            }}</span>
          </h1>
          <p dir="ltr" class="slug">/portal/{{ t.slug }}</p>
        </div>
        @if (t.status === 'Active') {
          <button
            mat-stroked-button
            type="button"
            class="danger"
            [disabled]="busy()"
            (click)="suspend(t)"
          >
            <mat-icon aria-hidden="true">block</mat-icon>
            {{ 'admin.detail.suspend' | transloco }}
          </button>
        } @else {
          <button mat-flat-button type="button" [disabled]="busy()" (click)="reactivate(t)">
            <mat-icon aria-hidden="true">play_arrow</mat-icon>
            {{ 'admin.detail.reactivate' | transloco }}
          </button>
        }
      </header>

      @if (t.status === 'Suspended') {
        <p class="form-alert" role="status">
          {{ 'admin.detail.suspendedSince' | transloco: { date: (t.suspendedAt | localDate) } }}
          @if (t.suspensionReason) {
            {{ 'admin.detail.reason' | transloco: { reason: t.suspensionReason } }}
          }
        </p>
      }
      <p class="form-notice" role="note">{{ 'admin.detail.readOnly' | transloco }}</p>

      <div class="grid">
        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title>{{ 'admin.detail.plan' | transloco }}</mat-card-title></mat-card-header
          >
          <mat-card-content>
            <dl>
              <div>
                <dt>{{ 'admin.tenants.plan' | transloco }}</dt>
                <dd>{{ t.planName }} · {{ money(t.monthlyPriceCents) }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.renews' | transloco }}</dt>
                <dd>{{ t.currentPeriodEnd ? (t.currentPeriodEnd | localDate: 'date') : '—' }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.tenants.created' | transloco }}</dt>
                <dd>{{ t.createdAt | localDate: 'date' }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.timezone' | transloco }}</dt>
                <dd dir="ltr">{{ t.timezone }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.language' | transloco }}</dt>
                <dd>{{ 'languages.' + t.defaultLanguage | transloco }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.setup' | transloco }}</dt>
                <dd>
                  {{
                    (t.onboardingCompleted ? 'admin.detail.setupDone' : 'admin.detail.setupPending')
                      | transloco
                  }}
                </dd>
              </div>
            </dl>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title>{{
              'admin.detail.usage' | transloco
            }}</mat-card-title></mat-card-header
          >
          <mat-card-content class="meters">
            @for (meter of meters(); track meter.key) {
              <div class="meter">
                <div class="meter-head">
                  <span>{{ 'billing.usage.' + meter.key | transloco }}</span>
                  <span>
                    {{
                      meter.limit === null
                        ? meter.used
                        : ('billing.usage.of' | transloco: { used: meter.used, limit: meter.limit })
                    }}
                  </span>
                </div>
                @if (meter.limit !== null) {
                  <mat-progress-bar
                    mode="determinate"
                    [value]="meter.percent"
                    [attr.aria-label]="'billing.usage.' + meter.key | transloco"
                  />
                }
              </div>
            }
            <p class="extra">
              {{
                'admin.detail.integrations'
                  | transloco: { keys: t.usage.activeApiKeys, webhooks: t.usage.webhooks }
              }}
            </p>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title>{{
              'admin.detail.activity' | transloco
            }}</mat-card-title></mat-card-header
          >
          <mat-card-content>
            <dl>
              <div>
                <dt>{{ 'admin.detail.tickets' | transloco }}</dt>
                <dd>{{ t.totals.tickets }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.open' | transloco }}</dt>
                <dd>{{ t.totals.openTickets }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.customers' | transloco }}</dt>
                <dd>{{ t.totals.customers }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.articles' | transloco }}</dt>
                <dd>{{ t.totals.kbArticles }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.detail.lastActivity' | transloco }}</dt>
                <dd>
                  {{
                    t.totals.lastTicketActivityAt
                      ? (t.totals.lastTicketActivityAt | localDate: 'relative')
                      : '—'
                  }}
                </dd>
              </div>
            </dl>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title>{{
              'admin.detail.admins' | transloco
            }}</mat-card-title></mat-card-header
          >
          <mat-card-content>
            <ul class="people">
              @for (person of t.admins; track person.email) {
                <li [class.inactive]="!person.isActive">
                  <strong>{{ person.fullName }}</strong>
                  <span class="badge muted">{{ 'roles.' + person.role | transloco }}</span>
                  <span class="sub" dir="ltr">{{ person.email }}</span>
                  <span class="sub">
                    {{ 'admin.detail.lastLogin' | transloco }}:
                    {{
                      person.lastLoginAt
                        ? (person.lastLoginAt | localDate: 'relative')
                        : ('admin.detail.never' | transloco)
                    }}
                  </span>
                </li>
              }
            </ul>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header
            ><mat-card-title>{{
              'admin.detail.invoices' | transloco
            }}</mat-card-title></mat-card-header
          >
          <mat-card-content>
            @if (t.recentInvoices.length === 0) {
              <p class="sub">{{ 'admin.detail.noInvoices' | transloco }}</p>
            }
            <ul class="invoices">
              @for (invoice of t.recentInvoices; track invoice.number) {
                <li>
                  <span dir="ltr">{{ invoice.number }}</span>
                  <span>{{ invoice.planName }}</span>
                  <span>{{ money(invoice.amountCents, invoice.currency) }}</span>
                  <span class="sub">{{ invoice.issuedAt | localDate: 'date' }}</span>
                </li>
              }
            </ul>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: `
    .back {
      margin-block-end: 8px;
    }

    h1 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .slug {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .danger {
      color: var(--mat-sys-error);
    }

    .form-alert,
    .form-notice {
      max-inline-size: 1200px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
      gap: 16px;
      margin-block-start: 16px;
    }

    mat-card-content {
      padding-block-start: 12px;
    }

    dl {
      display: grid;
      gap: 10px;
      margin: 0;
    }

    dl div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    dt {
      color: var(--mat-sys-on-surface-variant);
    }

    dd {
      margin: 0;
      text-align: end;
    }

    .meters {
      display: grid;
      gap: 14px;
    }

    .meter-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-block-end: 4px;
    }

    .extra,
    .sub {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .people li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      padding-block: 8px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .people .sub {
      flex-basis: 100%;
      overflow-wrap: anywhere;
    }

    .people .inactive strong {
      text-decoration: line-through;
    }

    .invoices li {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 12px;
      padding-block: 8px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }
  `,
})
export class AdminTenantDetailPage {
  private readonly api = inject(AdminApi);
  private readonly language = inject(LanguageService);
  private readonly notifier = inject(Notifier);
  private readonly confirm = inject(Confirm);
  private readonly prompt = inject(Prompt);

  readonly id = input.required<string>();
  protected readonly tenant = signal<AdminTenantDetail | null>(null);
  protected readonly busy = signal(false);

  protected readonly meters = computed(() => {
    const usage = this.tenant()?.usage;
    return usage
      ? toMeters({ ...usage, apiAccess: false }, (value) =>
          new Intl.NumberFormat(this.language.language()).format(value),
        )
      : [];
  });

  constructor() {
    toObservable(this.id)
      .pipe(switchMap((id) => this.api.tenant(id)))
      .subscribe((tenant) => this.tenant.set(tenant));
  }

  protected money(cents: number, currency = 'USD'): string {
    return formatMoney(cents, currency, this.language.language());
  }

  protected suspend(tenant: AdminTenantDetail): void {
    this.prompt
      .ask({
        title: this.notifier.translate('admin.detail.suspendTitle', { name: tenant.name }),
        label: this.notifier.translate('admin.detail.suspendReason'),
        value: '',
        maxLength: 500,
        confirmLabel: this.notifier.translate('admin.detail.suspend'),
      })
      .pipe(
        switchMap((reason) => {
          this.busy.set(true);
          return this.api.suspend(tenant.id, reason);
        }),
      )
      .subscribe({
        next: (saved) => this.done(saved, 'admin.detail.suspended'),
        error: () => this.busy.set(false),
      });
  }

  protected reactivate(tenant: AdminTenantDetail): void {
    this.confirm
      .ask({
        title: this.notifier.translate('admin.detail.reactivateTitle', { name: tenant.name }),
        message: this.notifier.translate('admin.detail.reactivateBody'),
        confirmLabel: this.notifier.translate('admin.detail.reactivate'),
      })
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return this.api.reactivate(tenant.id);
        }),
      )
      .subscribe({
        next: (saved) => this.done(saved, 'admin.detail.reactivated'),
        error: () => this.busy.set(false),
      });
  }

  private done(saved: AdminTenantDetail, message: string): void {
    this.tenant.set(saved);
    this.busy.set(false);
    this.notifier.success(message);
  }
}
