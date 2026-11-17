import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { LanguageService } from '../core/i18n/language.service';
import { ThemeService } from '../core/theme/theme.service';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

export type ChartKind = 'line' | 'bar' | 'doughnut';

export interface ChartSeries {
  readonly label: string;
  readonly values: readonly (number | null)[];
}

/** The theme colours series are drawn in, in order. */
const SERIES_COLOURS = [
  '--mat-sys-primary',
  '--mat-sys-tertiary',
  '--mat-sys-error',
  '--mat-sys-secondary',
  '--mat-sys-outline',
];

/**
 * A chart drawn with Chart.js in the colours of the current theme. It follows theme and language
 * switches, mirrors itself for right-to-left languages, and carries the same numbers as a table
 * for people who cannot see the drawing.
 */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas" [style.block-size.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="label()"></canvas>
    </div>
    <table class="visually-hidden">
      <caption>
        {{
          label()
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col"></th>
          @for (item of series(); track item.label) {
            <th scope="col">{{ item.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (category of categories(); track $index; let row = $index) {
          <tr>
            <th scope="row">{{ category }}</th>
            @for (item of series(); track item.label) {
              <td>{{ item.values[row] ?? '' }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
    }

    .canvas {
      position: relative;
      inline-size: 100%;
    }
  `,
})
export class AppChart implements OnDestroy {
  private readonly theme = inject(ThemeService);
  private readonly language = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart: Chart | null = null;

  readonly kind = input.required<ChartKind>();
  /** What the chart shows, read out by screen readers. */
  readonly label = input.required<string>();
  readonly categories = input.required<readonly string[]>();
  readonly series = input.required<readonly ChartSeries[]>();
  readonly height = input(280);
  /** Bars drawn side to side instead of upwards. */
  readonly horizontal = input(false, { transform: booleanAttribute });
  readonly stacked = input(false, { transform: booleanAttribute });
  /** The largest value of the value axis, for percentages. */
  readonly max = input<number | null>(null);

  private readonly configuration = computed<ChartConfiguration>(() => {
    // Read so the chart is rebuilt when the theme or the language changes.
    this.theme.isDark();
    const rtl = this.language.direction() === 'rtl';
    const styles = getComputedStyle(this.host.nativeElement);
    const colour = (name: string) => styles.getPropertyValue(name).trim() || '#888';
    Chart.defaults.font.family = styles.fontFamily;
    const text = colour('--mat-sys-on-surface-variant');
    const grid = colour('--mat-sys-outline-variant');
    const colours = SERIES_COLOURS.map(colour);
    const kind = this.kind();
    const doughnut = kind === 'doughnut';
    const valueAxis = {
      beginAtZero: true,
      max: this.max() ?? undefined,
      stacked: this.stacked(),
      ticks: { color: text, precision: 0 },
      grid: { color: grid },
      border: { display: false },
    };
    const categoryAxis = {
      stacked: this.stacked(),
      reverse: rtl && !this.horizontal(),
      ticks: { color: text, maxRotation: 0, autoSkipPadding: 12 },
      grid: { display: false },
      border: { color: grid },
    };

    return {
      type: kind,
      data: {
        labels: [...this.categories()],
        datasets: this.series().map((item, index) => ({
          label: item.label,
          data: [...item.values],
          borderColor: doughnut ? colour('--mat-sys-surface') : colours[index % colours.length],
          backgroundColor: doughnut
            ? this.categories().map((_, slice) => colours[slice % colours.length])
            : kind === 'line'
              ? `color-mix(in srgb, ${colours[index % colours.length]} 14%, transparent)`
              : colours[index % colours.length],
          borderWidth: kind === 'bar' ? 0 : 2,
          borderRadius: kind === 'bar' ? 4 : 0,
          fill: kind === 'line' && this.series().length === 1,
          tension: 0.3,
          pointRadius: this.categories().length > 45 ? 0 : 2,
          spanGaps: true,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal() ? 'y' : 'x',
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: doughnut || this.series().length > 1,
            position: 'bottom',
            rtl,
            labels: { color: text, usePointStyle: true, boxHeight: 8 },
          },
          tooltip: { rtl, textDirection: rtl ? 'rtl' : 'ltr' },
        },
        scales: doughnut
          ? {}
          : this.horizontal()
            ? {
                x: { ...valueAxis, reverse: rtl },
                y: { ...categoryAxis, position: rtl ? 'right' : 'left' },
              }
            : { x: categoryAxis, y: { ...valueAxis, position: rtl ? 'right' : 'left' } },
      },
    } as ChartConfiguration;
  });

  constructor() {
    effect(() => {
      const configuration = this.configuration();
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, configuration);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
