import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminApi, MonthlyPoint, PlatformMetrics } from '../core/api/admin.api';
import { formatMoney } from '../core/api/billing.api';
import { LanguageService } from '../core/i18n/language.service';
import { Notifier } from '../core/ui/notifier';
import { AppChart, ChartSeries } from '../shared/chart';

/** "Nov 2026" in the reader's language, for a month given as yyyy-mm-dd. */
export function monthLabel(month: string, language: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(language, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
}

@Component({
  selector: 'app-admin-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppChart, MatButtonModule, MatCardModule, RouterLink, TranslocoPipe],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'admin.overview.title' | transloco }}</h1>
        <p>{{ 'admin.overview.subtitle' | transloco }}</p>
      </div>
    </header>

    @if (metrics(); as m) {
      <section class="tiles" [attr.aria-label]="'admin.overview.figures' | transloco">
        <mat-card appearance="outlined">
          <span class="tile-label">{{ 'admin.overview.mrr' | transloco }}</span>
          <strong>{{ money(m.overview.mrrCents) }}</strong>
          <span class="tile-note">{{ 'admin.overview.mrrNote' | transloco }}</span>
        </mat-card>
        <mat-card appearance="outlined">
          <span class="tile-label">{{ 'admin.overview.paying' | transloco }}</span>
          <strong>{{ number(m.overview.payingWorkspaces) }}</strong>
          <span class="tile-note">{{
            'admin.overview.arpa' | transloco: { amount: averageRevenue() }
          }}</span>
        </mat-card>
        <mat-card appearance="outlined">
          <span class="tile-label">{{ 'admin.overview.workspaces' | transloco }}</span>
          <strong>{{ number(m.overview.workspaces) }}</strong>
          <span class="tile-note">{{
            'admin.overview.statusSplit'
              | transloco
                : {
                    active: number(m.overview.activeWorkspaces),
                    suspended: number(m.overview.suspendedWorkspaces),
                  }
          }}</span>
        </mat-card>
        <mat-card appearance="outlined">
          <span class="tile-label">{{ 'admin.overview.signups' | transloco }}</span>
          <strong>{{ number(m.overview.signupsLast30Days) }}</strong>
          <span class="tile-note">{{ 'admin.overview.last30' | transloco }}</span>
        </mat-card>
      </section>

      <div class="charts">
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'admin.overview.revenueTitle' | transloco }}</mat-card-title>
            <mat-card-subtitle>{{ 'admin.overview.revenueHint' | transloco }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <app-chart
              kind="line"
              [label]="'admin.overview.revenueTitle' | transloco"
              [categories]="months(m.mrr)"
              [series]="revenueSeries()"
              [height]="240"
            />
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'admin.overview.signupsTitle' | transloco }}</mat-card-title>
            <mat-card-subtitle>{{ 'admin.overview.signupsHint' | transloco }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <app-chart
              kind="bar"
              [label]="'admin.overview.signupsTitle' | transloco"
              [categories]="months(m.signups)"
              [series]="signupSeries()"
              [height]="240"
            />
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card appearance="outlined" class="plans">
        <mat-card-header>
          <mat-card-title>{{ 'admin.overview.plansTitle' | transloco }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table>
            <caption class="visually-hidden">
              {{
                'admin.overview.plansTitle' | transloco
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'admin.tenants.plan' | transloco }}</th>
                <th scope="col" class="number">{{ 'admin.overview.activeOnPlan' | transloco }}</th>
                <th scope="col" class="number">{{ 'admin.overview.mrr' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (plan of m.overview.plans; track plan.planCode) {
                <tr>
                  <th scope="row">
                    <a routerLink="/admin/tenants" [queryParams]="{ plan: plan.planCode }">{{
                      plan.planName
                    }}</a>
                  </th>
                  <td class="number">{{ number(plan.workspaces) }}</td>
                  <td class="number">{{ money(plan.mrrCents) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-block-end: 16px;
    }

    .tiles mat-card {
      display: grid;
      gap: 4px;
      padding: 16px;
    }

    .tile-label,
    .tile-note {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .tiles strong {
      font: var(--mat-sys-headline-medium);
    }

    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
      gap: 16px;
      margin-block-end: 16px;
    }

    mat-card-content {
      padding-block-start: 12px;
    }

    table {
      inline-size: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 10px 12px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
      text-align: start;
    }

    thead th {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .number {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }

    tbody a {
      color: var(--mat-sys-primary);
    }
  `,
})
export class AdminOverview {
  private readonly api = inject(AdminApi);
  private readonly language = inject(LanguageService);
  private readonly notifier = inject(Notifier);

  protected readonly metrics = signal<PlatformMetrics | null>(null);

  protected readonly revenueSeries = computed<ChartSeries[]>(() => {
    this.language.translations();
    const m = this.metrics();
    return m
      ? [
          {
            label: this.notifier.translate('admin.overview.revenueSeries'),
            values: m.mrr.map((p) => p.value / 100),
          },
        ]
      : [];
  });

  protected readonly signupSeries = computed<ChartSeries[]>(() => {
    this.language.translations();
    const m = this.metrics();
    return m
      ? [
          {
            label: this.notifier.translate('admin.overview.signupSeries'),
            values: m.signups.map((p) => p.value),
          },
        ]
      : [];
  });

  protected readonly averageRevenue = computed(() => {
    const overview = this.metrics()?.overview;
    return overview && overview.payingWorkspaces > 0
      ? this.money(Math.round(overview.mrrCents / overview.payingWorkspaces))
      : this.money(0);
  });

  constructor() {
    this.api.metrics(12).subscribe((metrics) => this.metrics.set(metrics));
  }

  protected months(points: readonly MonthlyPoint[]): string[] {
    return points.map((point) => monthLabel(point.month, this.language.language()));
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.metrics()?.overview.currency ?? 'USD', this.language.language());
  }

  protected number(value: number): string {
    return new Intl.NumberFormat(this.language.language()).format(value);
  }
}
