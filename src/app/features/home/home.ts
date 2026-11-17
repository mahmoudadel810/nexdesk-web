import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { Backlog, Overview, ReportsApi, VolumePoint } from '../../core/api/reports.api';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { Notifier } from '../../core/ui/notifier';
import { AppChart, ChartSeries } from '../../shared/chart';
import { axisDate, formatDuration } from '../reports/report-format';

/** The first page after signing in: how the help desk is doing over the last 30 days. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppChart, MatButtonModule, MatCardModule, MatIconModule, RouterLink, TranslocoPipe],
  template: `
    @if (auth.session(); as session) {
      <header class="page-header">
        <div>
          <h1>{{ 'home.welcome' | transloco: { name: session.user.fullName } }}</h1>
          <p>{{ 'home.subtitle' | transloco: { workspace: session.tenant?.name } }}</p>
        </div>
        @if (auth.can('tickets.create')) {
          <a mat-flat-button routerLink="/app/tickets/new">
            <mat-icon aria-hidden="true">add</mat-icon>
            {{ 'home.newTicket' | transloco }}
          </a>
        }
      </header>

      @if (overview(); as data) {
        <section class="kpis" [attr.aria-label]="'home.kpis' | transloco">
          <mat-card appearance="outlined">
            <mat-card-content>
              <p class="kpi-label">{{ 'reports.kpis.backlog' | transloco }}</p>
              <p class="kpi-value">{{ data.openBacklog }}</p>
              <p class="kpi-hint">
                {{ 'home.unassigned' | transloco: { count: backlog()?.unassigned ?? 0 } }}
              </p>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <p class="kpi-label">{{ 'reports.kpis.created' | transloco }}</p>
              <p class="kpi-value">{{ data.created }}</p>
              <p class="kpi-hint">{{ 'home.solved' | transloco: { count: data.solved } }}</p>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <p class="kpi-label">{{ 'reports.kpis.firstResponse' | transloco }}</p>
              <p class="kpi-value">{{ duration(data.avgFirstResponseMinutes) }}</p>
              <p class="kpi-hint">
                {{ 'home.resolution' | transloco: { time: duration(data.avgResolutionMinutes) } }}
              </p>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <p class="kpi-label">{{ 'reports.kpis.sla' | transloco }}</p>
              <p class="kpi-value">
                {{ data.slaCompliancePercent === null ? '–' : data.slaCompliancePercent + '%' }}
              </p>
              <p class="kpi-hint">
                @if (data.csatAverage !== null) {
                  {{ 'home.csat' | transloco: { average: data.csatAverage } }}
                } @else {
                  {{ 'home.noCsat' | transloco }}
                }
              </p>
            </mat-card-content>
          </mat-card>
        </section>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'reports.volume.title' | transloco }}</mat-card-title>
            <mat-card-subtitle>{{ 'home.last30Days' | transloco }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <app-chart
              kind="line"
              [label]="'reports.volume.title' | transloco"
              [categories]="dates()"
              [series]="series()"
              [height]="260"
            />
          </mat-card-content>
          <mat-card-actions align="end">
            <a mat-button routerLink="/app/reports">{{ 'home.allReports' | transloco }}</a>
          </mat-card-actions>
        </mat-card>
      }
    }
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
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

    mat-card-content {
      padding-block-start: 16px;
    }
  `,
})
export class Home {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ReportsApi);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly overview = signal<Overview | null>(null);
  protected readonly backlog = signal<Backlog | null>(null);
  private readonly volume = signal<readonly VolumePoint[]>([]);

  protected readonly dates = computed(() =>
    this.volume().map((point) => axisDate(point.date, this.language.language())),
  );
  protected readonly series = computed<ChartSeries[]>(() => {
    this.language.language();
    return [
      {
        label: this.notifier.translate('reports.volume.created'),
        values: this.volume().map((point) => point.created),
      },
      {
        label: this.notifier.translate('reports.volume.solved'),
        values: this.volume().map((point) => point.solved),
      },
    ];
  });

  constructor() {
    if (this.auth.can('reports.view')) {
      forkJoin({
        overview: this.api.overview(null),
        volume: this.api.volume(null),
        backlog: this.api.backlog(),
      }).subscribe((data) => {
        this.overview.set(data.overview);
        this.volume.set(data.volume);
        this.backlog.set(data.backlog);
      });
    }
  }

  protected duration(minutes: number | null): string {
    return formatDuration(
      minutes,
      (key, params) => this.notifier.translate(key, params),
      this.language.language(),
    );
  }
}
