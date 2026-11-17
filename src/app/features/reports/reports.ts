import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import {
  AgentRow,
  Backlog,
  CsatReport,
  DateRange,
  Overview,
  REPORT_NAMES,
  ReportName,
  ReportsApi,
  ResponseTimePoint,
  SlaCompliance,
  VolumePoint,
  lastDays,
} from '../../core/api/reports.api';
import { toProblem } from '../../core/http/problem';
import { LanguageService } from '../../core/i18n/language.service';
import { Notifier } from '../../core/ui/notifier';
import { AppChart, ChartSeries } from '../../shared/chart';
import { axisDate, change, formatDuration } from './report-format';

type Preset = 7 | 30 | 90 | 'custom';

interface Kpi {
  readonly key: string;
  readonly value: string;
  readonly hint?: string;
  /** Signed percentage against the previous period. */
  readonly change?: number | null;
}

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppChart,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatTableModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'reports.title' | transloco }}</h1>
        <p>{{ 'reports.subtitle' | transloco }}</p>
      </div>
      <button mat-stroked-button type="button" [matMenuTriggerFor]="exports">
        <mat-icon aria-hidden="true">download</mat-icon>
        {{ 'reports.export.button' | transloco }}
      </button>
      <mat-menu #exports="matMenu">
        @for (name of reportNames; track name) {
          <button mat-menu-item type="button" (click)="export(name)">
            {{ 'reports.export.names.' + name | transloco }}
          </button>
        }
      </mat-menu>
    </header>

    <div class="range">
      <mat-button-toggle-group
        [value]="preset()"
        (change)="choose($event.value)"
        [attr.aria-label]="'reports.range.label' | transloco"
        hideSingleSelectionIndicator
      >
        <mat-button-toggle [value]="7">{{
          'reports.range.days' | transloco: { count: 7 }
        }}</mat-button-toggle>
        <mat-button-toggle [value]="30">{{
          'reports.range.days' | transloco: { count: 30 }
        }}</mat-button-toggle>
        <mat-button-toggle [value]="90">{{
          'reports.range.days' | transloco: { count: 90 }
        }}</mat-button-toggle>
        <mat-button-toggle value="custom">{{
          'reports.range.custom' | transloco
        }}</mat-button-toggle>
      </mat-button-toggle-group>
      @if (preset() === 'custom') {
        <form class="dates" (ngSubmit)="applyCustom()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'reports.range.from' | transloco }}</mat-label>
            <input
              matInput
              type="date"
              name="from"
              required
              [max]="customTo()"
              [(ngModel)]="customFrom"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'reports.range.to' | transloco }}</mat-label>
            <input
              matInput
              type="date"
              name="to"
              required
              [min]="customFrom()"
              [(ngModel)]="customTo"
            />
          </mat-form-field>
          <button mat-flat-button type="submit">{{ 'reports.range.apply' | transloco }}</button>
        </form>
      }
      @if (overview(); as data) {
        <p class="period" aria-live="polite">
          {{
            'reports.range.shown'
              | transloco
                : { from: data.range.from, to: data.range.to, timezone: data.range.timezone }
          }}
        </p>
      }
    </div>
    @if (error(); as message) {
      <p class="form-alert" role="alert">{{ message }}</p>
    }

    <section class="kpis" [attr.aria-label]="'reports.kpis.label' | transloco">
      @for (kpi of kpis(); track kpi.key) {
        <mat-card appearance="outlined">
          <mat-card-content>
            <p class="kpi-label">{{ 'reports.kpis.' + kpi.key | transloco }}</p>
            <p class="kpi-value">{{ kpi.value }}</p>
            @if (kpi.change !== undefined && kpi.change !== null) {
              <p class="kpi-hint">
                {{
                  (kpi.change >= 0 ? 'reports.kpis.up' : 'reports.kpis.down')
                    | transloco: { percent: abs(kpi.change) }
                }}
              </p>
            } @else if (kpi.hint) {
              <p class="kpi-hint">{{ kpi.hint }}</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </section>

    <div class="charts">
      <mat-card appearance="outlined" class="wide">
        <mat-card-header>
          <mat-card-title>{{ 'reports.volume.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ bucketHint() | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-chart
            kind="line"
            [label]="'reports.volume.title' | transloco"
            [categories]="volumeDates()"
            [series]="volumeSeries()"
          />
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'reports.backlog.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>
            {{ 'reports.backlog.subtitle' | transloco: { unassigned: backlog()?.unassigned ?? 0 } }}
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (hasBacklog()) {
            <app-chart
              kind="doughnut"
              [label]="'reports.backlog.title' | transloco"
              [categories]="backlogLabels()"
              [series]="backlogSeries()"
              [height]="260"
            />
          } @else {
            <p class="none">{{ 'reports.backlog.empty' | transloco }}</p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'reports.backlog.byPriority' | transloco }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <app-chart
            kind="bar"
            horizontal
            [label]="'reports.backlog.byPriority' | transloco"
            [categories]="priorityLabels()"
            [series]="prioritySeries()"
            [height]="260"
          />
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="wide">
        <mat-card-header>
          <mat-card-title>{{ 'reports.times.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'reports.times.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-chart
            kind="line"
            [label]="'reports.times.title' | transloco"
            [categories]="timeDates()"
            [series]="timeSeries()"
          />
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'reports.sla.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'reports.sla.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-chart
            kind="bar"
            [label]="'reports.sla.title' | transloco"
            [categories]="priorityLabels()"
            [series]="slaSeries()"
            [max]="100"
            [height]="260"
          />
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'reports.csat.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>
            @if (csat(); as data) {
              @if (data.responses > 0) {
                {{
                  'reports.csat.subtitle'
                    | transloco
                      : {
                          average: data.average,
                          responses: data.responses,
                          satisfied: data.satisfiedPercent,
                        }
                }}
              } @else {
                {{ 'reports.csat.empty' | transloco }}
              }
            }
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-chart
            kind="bar"
            [label]="'reports.csat.title' | transloco"
            [categories]="ratingLabels()"
            [series]="ratingSeries()"
            [height]="260"
          />
        </mat-card-content>
      </mat-card>
    </div>

    <h2>{{ 'reports.agents.title' | transloco }}</h2>
    <div class="table-card">
      <table mat-table [dataSource]="agents()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ 'reports.agents.name' | transloco }}</th>
          <td mat-cell *matCellDef="let agent">{{ agent.name }}</td>
        </ng-container>
        <ng-container matColumnDef="solved">
          <th mat-header-cell *matHeaderCellDef>{{ 'reports.agents.solved' | transloco }}</th>
          <td mat-cell *matCellDef="let agent">{{ agent.solved }}</td>
        </ng-container>
        <ng-container matColumnDef="open">
          <th mat-header-cell *matHeaderCellDef>{{ 'reports.agents.open' | transloco }}</th>
          <td mat-cell *matCellDef="let agent">{{ agent.assignedOpen }}</td>
        </ng-container>
        <ng-container matColumnDef="firstResponse">
          <th mat-header-cell *matHeaderCellDef>
            {{ 'reports.agents.firstResponse' | transloco }}
          </th>
          <td mat-cell *matCellDef="let agent">{{ duration(agent.avgFirstResponseMinutes) }}</td>
        </ng-container>
        <ng-container matColumnDef="resolution">
          <th mat-header-cell *matHeaderCellDef>{{ 'reports.agents.resolution' | transloco }}</th>
          <td mat-cell *matCellDef="let agent">{{ duration(agent.avgResolutionMinutes) }}</td>
        </ng-container>
        <ng-container matColumnDef="csat">
          <th mat-header-cell *matHeaderCellDef>{{ 'reports.agents.csat' | transloco }}</th>
          <td mat-cell *matCellDef="let agent">
            @if (agent.csatAverage !== null) {
              {{
                'reports.agents.csatValue'
                  | transloco: { average: agent.csatAverage, responses: agent.csatResponses }
              }}
            } @else {
              –
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="agentColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: agentColumns"></tr>
      </table>
    </div>
  `,
  styles: `
    h2 {
      font: var(--mat-sys-title-large);
      margin: 32px 0 16px;
    }

    .range {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
      margin-block-end: 24px;
    }

    .dates {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .dates mat-form-field {
      inline-size: 170px;
    }

    .period {
      flex: 1 1 100%;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-block-end: 16px;
    }

    .kpi-label,
    .kpi-hint {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .kpi-value {
      margin: 4px 0;
      font: var(--mat-sys-headline-small);
    }

    .charts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .charts .wide {
      grid-column: 1 / -1;
    }

    .charts mat-card-content {
      padding-block-start: 16px;
    }

    .none {
      margin: 0;
      padding-block: 48px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 800px) {
      .charts {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Reports {
  private readonly api = inject(ReportsApi);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly reportNames = REPORT_NAMES;
  protected readonly agentColumns = [
    'name',
    'solved',
    'open',
    'firstResponse',
    'resolution',
    'csat',
  ];
  protected readonly preset = signal<Preset>(30);
  protected readonly customFrom = signal(lastDays(30).from);
  protected readonly customTo = signal(lastDays(30).to);
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<Overview | null>(null);
  protected readonly volume = signal<readonly VolumePoint[]>([]);
  protected readonly backlog = signal<Backlog | null>(null);
  protected readonly times = signal<readonly ResponseTimePoint[]>([]);
  protected readonly sla = signal<SlaCompliance | null>(null);
  protected readonly csat = signal<CsatReport | null>(null);
  protected readonly agents = signal<readonly AgentRow[]>([]);
  private range: DateRange = lastDays(30);

  protected readonly kpis = computed<Kpi[]>(() => {
    const data = this.overview();
    if (!data) {
      return [];
    }

    const t = (key: string, params?: Record<string, unknown>) =>
      this.notifier.translate(key, params);
    const percent = (value: number | null) => (value === null ? '–' : `${this.number(value)}%`);
    return [
      {
        key: 'created',
        value: this.number(data.created),
        change: change(data.created, data.previousCreated),
      },
      {
        key: 'solved',
        value: this.number(data.solved),
        change: change(data.solved, data.previousSolved),
      },
      { key: 'backlog', value: this.number(data.openBacklog), hint: t('reports.kpis.now') },
      { key: 'firstResponse', value: this.duration(data.avgFirstResponseMinutes) },
      { key: 'resolution', value: this.duration(data.avgResolutionMinutes) },
      { key: 'sla', value: percent(data.slaCompliancePercent) },
      {
        key: 'csat',
        value:
          data.csatAverage === null
            ? '–'
            : t('reports.kpis.csatValue', { average: this.number(data.csatAverage) }),
        hint: t('reports.kpis.responses', { count: this.number(data.csatResponses) }),
      },
    ];
  });

  protected readonly bucketHint = computed(() =>
    this.overview()?.range.bucket === 'Week' ? 'reports.volume.weekly' : 'reports.volume.daily',
  );
  protected readonly volumeDates = computed(() =>
    this.volume().map((point) => this.axis(point.date)),
  );
  protected readonly volumeSeries = computed<ChartSeries[]>(() => [
    {
      label: this.t('reports.volume.created'),
      values: this.volume().map((point) => point.created),
    },
    { label: this.t('reports.volume.solved'), values: this.volume().map((point) => point.solved) },
  ]);
  protected readonly hasBacklog = computed(() =>
    (this.backlog()?.byStatus ?? []).some((item) => item.count > 0),
  );
  protected readonly backlogLabels = computed(() =>
    (this.backlog()?.byStatus ?? []).map((item) => this.t(`ticketStatus.${item.status}`)),
  );
  protected readonly backlogSeries = computed<ChartSeries[]>(() => [
    {
      label: this.t('reports.backlog.tickets'),
      values: (this.backlog()?.byStatus ?? []).map((item) => item.count),
    },
  ]);
  protected readonly priorityLabels = computed(() =>
    (this.backlog()?.byPriority ?? []).map((item) => this.t(`ticketPriority.${item.priority}`)),
  );
  protected readonly prioritySeries = computed<ChartSeries[]>(() => [
    {
      label: this.t('reports.backlog.tickets'),
      values: (this.backlog()?.byPriority ?? []).map((item) => item.count),
    },
  ]);
  protected readonly timeDates = computed(() => this.times().map((point) => this.axis(point.date)));
  protected readonly timeSeries = computed<ChartSeries[]>(() => [
    {
      label: this.t('reports.times.firstResponse'),
      values: this.times().map((point) => hours(point.avgFirstResponseMinutes)),
    },
    {
      label: this.t('reports.times.resolution'),
      values: this.times().map((point) => hours(point.avgResolutionMinutes)),
    },
  ]);
  protected readonly slaSeries = computed<ChartSeries[]>(() => {
    const rows = this.sla()?.byPriority ?? [];
    return [
      {
        label: this.t('reports.sla.firstResponse'),
        values: rows.map((row) => row.firstResponsePercent),
      },
      { label: this.t('reports.sla.resolution'), values: rows.map((row) => row.resolutionPercent) },
    ];
  });
  protected readonly ratingLabels = computed(() =>
    (this.csat()?.distribution ?? []).map((item) =>
      this.t('reports.csat.stars', { count: item.rating }),
    ),
  );
  protected readonly ratingSeries = computed<ChartSeries[]>(() => [
    {
      label: this.t('reports.csat.responses'),
      values: (this.csat()?.distribution ?? []).map((item) => item.count),
    },
  ]);

  constructor() {
    this.load();
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }

  protected duration(minutes: number | null): string {
    return formatDuration(
      minutes,
      (key, params) => this.notifier.translate(key, params),
      this.language.language(),
    );
  }

  protected choose(preset: Preset): void {
    this.preset.set(preset);
    if (preset !== 'custom') {
      this.range = lastDays(preset);
      this.load();
    }
  }

  protected applyCustom(): void {
    if (this.customFrom() && this.customTo()) {
      this.range = { from: this.customFrom(), to: this.customTo() };
      this.load();
    }
  }

  protected export(name: ReportName): void {
    this.api.exportCsv(name, this.range).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nexdesk-${name}-${this.range.from}-to-${this.range.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  private t(key: string, params?: Record<string, unknown>): string {
    // Reading the language makes labels follow a language switch.
    this.language.language();
    return this.notifier.translate(key, params);
  }

  private number(value: number): string {
    return new Intl.NumberFormat(this.language.language(), { maximumFractionDigits: 2 }).format(
      value,
    );
  }

  private axis(date: string): string {
    return axisDate(date, this.language.language());
  }

  private load(): void {
    const range = this.range;
    this.error.set(null);
    forkJoin({
      overview: this.api.overview(range),
      volume: this.api.volume(range),
      backlog: this.api.backlog(),
      times: this.api.responseTimes(range),
      sla: this.api.slaCompliance(range),
      csat: this.api.csat(range),
      agents: this.api.agents(range),
    }).subscribe({
      next: (data) => {
        this.overview.set(data.overview);
        this.volume.set(data.volume);
        this.backlog.set(data.backlog);
        this.times.set(data.times);
        this.sla.set(data.sla);
        this.csat.set(data.csat);
        this.agents.set(data.agents);
      },
      error: (failure: unknown) => this.error.set(this.notifier.problemMessage(toProblem(failure))),
    });
  }
}

function hours(minutes: number | null): number | null {
  return minutes === null ? null : Math.round((minutes / 60) * 10) / 10;
}
