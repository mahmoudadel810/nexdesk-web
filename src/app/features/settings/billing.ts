import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import {
  BillingApi,
  Invoice,
  Plan,
  Subscription,
  Usage,
  formatMoney,
} from '../../core/api/billing.api';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Notifier } from '../../core/ui/notifier';
import { formatFileSize } from '../../shared/file-size.pipe';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { CheckoutDialog, CheckoutDialogData } from './checkout-dialog';

/** One line of the usage card: how much of an allowance is used. */
export interface Meter {
  readonly key: string;
  readonly used: string;
  /** Null when the plan does not limit this. */
  readonly limit: string | null;
  readonly percent: number;
}

const NEARLY_FULL = 90;

export function toMeters(usage: Usage, formatNumber: (value: number) => string): Meter[] {
  const count = (key: string, used: number, limit: number | null): Meter => ({
    key,
    used: formatNumber(used),
    limit: limit === null ? null : formatNumber(limit),
    percent: limit === null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)),
  });

  return [
    count('agents', usage.agents, usage.maxAgents),
    count('tickets', usage.ticketsThisMonth, usage.maxTicketsPerMonth),
    {
      key: 'storage',
      used: formatFileSize(usage.storageBytes),
      limit: formatFileSize(usage.maxStorageBytes),
      percent: Math.min(100, Math.round((usage.storageBytes / usage.maxStorageBytes) * 100)),
    },
    count('automation', usage.automationRules, usage.maxAutomationRules),
  ];
}

@Component({
  selector: 'app-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'billing.title' | transloco }}</h1>
        <p>{{ 'billing.subtitle' | transloco }}</p>
      </div>
    </header>

    @if (subscription(); as current) {
      <div class="overview">
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-subtitle>{{ 'billing.currentPlan' | transloco }}</mat-card-subtitle>
            <mat-card-title>{{ current.plan.name }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="price">
              <strong>{{ money(current.plan.priceCentsMonthly, current.plan.currency) }}</strong>
              {{ 'billing.perMonth' | transloco }}
            </p>
            @if (current.currentPeriodEnd) {
              <p class="muted">
                {{ 'billing.renewsOn' | transloco }}
                {{ current.currentPeriodEnd | localDate: 'date' }}
              </p>
              @if (current.cardLast4) {
                <p class="muted">
                  {{
                    'billing.paidWith'
                      | transloco: { brand: current.cardBrand, last4: current.cardLast4 }
                  }}
                </p>
              }
            } @else {
              <p class="muted">{{ 'billing.freeForever' | transloco }}</p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'billing.usage.title' | transloco }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <ul class="meters">
              @for (meter of meters(); track meter.key) {
                <li>
                  <div class="meter-head">
                    <span [id]="'meter-' + meter.key">
                      {{ 'billing.usage.' + meter.key | transloco }}
                    </span>
                    <span>
                      @if (meter.limit === null) {
                        {{ meter.used }} · {{ 'billing.unlimited' | transloco }}
                      } @else {
                        {{
                          'billing.usage.of' | transloco: { used: meter.used, limit: meter.limit }
                        }}
                      }
                    </span>
                  </div>
                  @if (meter.limit !== null) {
                    <mat-progress-bar
                      mode="determinate"
                      [value]="meter.percent"
                      [class.nearly-full]="meter.percent >= nearlyFull"
                      [attr.aria-labelledby]="'meter-' + meter.key"
                    />
                  }
                </li>
              }
            </ul>
          </mat-card-content>
        </mat-card>
      </div>

      <h2>{{ 'billing.plans.title' | transloco }}</h2>
      <div class="plans">
        @for (plan of plans(); track plan.code) {
          <mat-card appearance="outlined" [class.current]="plan.code === current.plan.code">
            <mat-card-header>
              <mat-card-title>{{ plan.name }}</mat-card-title>
              <mat-card-subtitle>
                <strong>{{ money(plan.priceCentsMonthly, plan.currency) }}</strong>
                {{ 'billing.perMonth' | transloco }}
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <ul class="features">
                @for (feature of features(plan); track feature) {
                  <li>
                    <mat-icon aria-hidden="true">check</mat-icon>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>
            </mat-card-content>
            <mat-card-actions>
              @if (plan.code === current.plan.code) {
                <span class="badge">{{ 'billing.plans.current' | transloco }}</span>
              } @else if (canPay()) {
                <button
                  type="button"
                  [class]="isUpgrade(plan, current.plan) ? 'upgrade' : ''"
                  mat-stroked-button
                  (click)="change(plan, current.plan)"
                >
                  {{
                    (isUpgrade(plan, current.plan)
                      ? 'billing.plans.upgrade'
                      : 'billing.plans.downgrade'
                    ) | transloco: { plan: plan.name }
                  }}
                </button>
              } @else {
                <span class="muted">{{ 'billing.plans.ownerOnly' | transloco }}</span>
              }
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (canPay()) {
        <h2>{{ 'billing.invoices.title' | transloco }}</h2>
        <div class="table-card">
          <table mat-table [dataSource]="invoices()">
            <ng-container matColumnDef="number">
              <th mat-header-cell *matHeaderCellDef>{{ 'billing.invoices.number' | transloco }}</th>
              <td mat-cell *matCellDef="let invoice">{{ invoice.number }}</td>
            </ng-container>
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>{{ 'billing.invoices.date' | transloco }}</th>
              <td mat-cell *matCellDef="let invoice">{{ invoice.issuedAt | localDate: 'date' }}</td>
            </ng-container>
            <ng-container matColumnDef="plan">
              <th mat-header-cell *matHeaderCellDef>{{ 'billing.invoices.plan' | transloco }}</th>
              <td mat-cell *matCellDef="let invoice">
                {{ invoice.planName }} ·
                {{ 'billing.invoices.reasons.' + invoice.reason | transloco }}
              </td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>{{ 'billing.invoices.amount' | transloco }}</th>
              <td mat-cell *matCellDef="let invoice">
                {{ money(invoice.amountCents, invoice.currency) }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>{{ 'billing.invoices.status' | transloco }}</th>
              <td mat-cell *matCellDef="let invoice">
                <span class="badge">{{ 'billing.invoices.paid' | transloco }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="download">
              <th mat-header-cell *matHeaderCellDef>
                <span class="visually-hidden">{{ 'common.actions' | transloco }}</span>
              </th>
              <td mat-cell *matCellDef="let invoice">
                <button
                  mat-icon-button
                  type="button"
                  [attr.aria-label]="
                    'billing.invoices.download' | transloco: { number: invoice.number }
                  "
                  (click)="download(invoice)"
                >
                  <mat-icon aria-hidden="true">download</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
            <tr class="mat-mdc-row" *matNoDataRow>
              <td class="mat-mdc-cell empty" [attr.colspan]="columns.length">
                {{ 'billing.invoices.empty' | transloco }}
              </td>
            </tr>
          </table>
          <mat-paginator
            [length]="invoiceTotal()"
            [pageIndex]="invoicePage() - 1"
            [pageSize]="invoicePageSize"
            hidePageSize
            (page)="onInvoicePage($event)"
          />
        </div>
      }
    }
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-large);
      margin: 32px 0 16px;
    }

    .overview {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      gap: 16px;
    }

    .price {
      margin: 12px 0 4px;
    }

    .price strong {
      font: var(--mat-sys-headline-medium);
    }

    .muted {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .meters {
      display: grid;
      gap: 16px;
      padding-block-start: 12px;
    }

    .meter-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 6px;
    }

    .meter-head span:last-child {
      color: var(--mat-sys-on-surface-variant);
    }

    .nearly-full {
      --mat-progress-bar-active-indicator-color: var(--mat-sys-error);
    }

    .plans {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .plans mat-card {
      display: flex;
      flex-direction: column;
    }

    .plans mat-card.current {
      border-color: var(--mat-sys-primary);
      border-width: 2px;
    }

    .plans mat-card-subtitle strong {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
    }

    .plans mat-card-content {
      flex: 1 1 auto;
    }

    .features {
      display: grid;
      gap: 8px;
      padding-block: 16px;
    }

    .features li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .features mat-icon {
      flex: none;
      font-size: 20px;
      inline-size: 20px;
      block-size: 20px;
      color: var(--mat-sys-primary);
    }

    .plans mat-card-actions {
      padding: 8px 16px 16px;
      min-block-size: 40px;
    }

    .upgrade {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .empty {
      padding: 24px 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 800px) {
      .overview {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Billing {
  private readonly api = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly columns = ['number', 'date', 'plan', 'amount', 'status', 'download'];
  protected readonly nearlyFull = NEARLY_FULL;
  protected readonly invoicePageSize = 10;
  protected readonly plans = signal<readonly Plan[]>([]);
  protected readonly subscription = signal<Subscription | null>(null);
  protected readonly usage = signal<Usage | null>(null);
  protected readonly invoices = signal<readonly Invoice[]>([]);
  protected readonly invoiceTotal = signal(0);
  protected readonly invoicePage = signal(1);
  protected readonly canPay = computed(() => this.auth.can('billing.manage'));
  protected readonly meters = computed(() => {
    const usage = this.usage();
    return usage ? toMeters(usage, (value) => this.number(value)) : [];
  });

  constructor() {
    this.api.plans().subscribe((plans) => this.plans.set(plans));
    this.load();
  }

  protected money(cents: number, currency: string): string {
    return formatMoney(cents, currency, this.language.language());
  }

  protected isUpgrade(plan: Plan, current: Plan): boolean {
    return plan.priceCentsMonthly > current.priceCentsMonthly;
  }

  /** What a plan includes, in words. */
  protected features(plan: Plan): string[] {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.notifier.translate(`billing.features.${key}`, params);
    const amount = (limit: number | null, key: string) =>
      limit === null ? t(`${key}Unlimited`) : t(key, { count: this.number(limit) });
    return [
      amount(plan.maxAgents, 'agents'),
      amount(plan.maxTicketsPerMonth, 'tickets'),
      t('storage', { size: formatFileSize(plan.maxStorageBytes) }),
      amount(plan.maxAutomationRules, 'automation'),
      t(plan.apiAccess ? 'api' : 'noApi'),
      t('requests', { count: this.number(plan.requestsPerMinute) }),
    ];
  }

  protected change(plan: Plan, current: Plan): void {
    this.dialog
      .open<CheckoutDialog, CheckoutDialogData, Subscription>(CheckoutDialog, {
        data: { plan, current },
        width: '520px',
      })
      .afterClosed()
      .pipe(filter((subscription) => subscription !== undefined))
      .subscribe((subscription) => {
        this.notifier.success('billing.changed', { plan: subscription.plan.name });
        this.invoicePage.set(1);
        this.load();
      });
  }

  protected onInvoicePage(event: PageEvent): void {
    this.invoicePage.set(event.pageIndex + 1);
    this.loadInvoices();
  }

  protected download(invoice: Invoice): void {
    this.api.invoicePdf(invoice.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  private number(value: number): string {
    return new Intl.NumberFormat(this.language.language()).format(value);
  }

  private load(): void {
    this.api.subscription().subscribe((subscription) => this.subscription.set(subscription));
    this.api.usage().subscribe((usage) => this.usage.set(usage));
    if (this.canPay()) {
      this.loadInvoices();
    }
  }

  private loadInvoices(): void {
    this.api.invoices(this.invoicePage(), this.invoicePageSize).subscribe((page) => {
      this.invoices.set(page.items);
      this.invoiceTotal.set(page.totalCount);
    });
  }
}
