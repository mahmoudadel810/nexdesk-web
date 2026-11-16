import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { TicketSla, TicketStatus } from '../core/api/tickets.api';
import { LanguageService } from '../core/i18n/language.service';
import { formatLocalDate } from './local-date.pipe';

export type SlaState = 'breached' | 'soon' | 'ok' | 'met' | 'paused';

export interface SlaLine {
  readonly metric: 'firstResponse' | 'resolution';
  readonly state: SlaState;
  readonly dueAt: string | null;
}

/** Deadlines closer than this are highlighted as needing attention soon. */
const SOON_MS = 60 * 60 * 1000;

/** Works out what to show for each SLA clock of a ticket at a given moment. */
export function slaLines(sla: TicketSla, status: TicketStatus, now: number): SlaLine[] {
  if (status === 'Closed') {
    return [];
  }

  const lines: SlaLine[] = [];
  const state = (dueAt: string): SlaState => (Date.parse(dueAt) - now <= SOON_MS ? 'soon' : 'ok');

  if (sla.firstResponseBreached) {
    lines.push({ metric: 'firstResponse', state: 'breached', dueAt: sla.firstResponseDueAt });
  } else if (sla.firstResponseMet) {
    lines.push({ metric: 'firstResponse', state: 'met', dueAt: null });
  } else if (sla.firstResponseDueAt) {
    const overdue = Date.parse(sla.firstResponseDueAt) <= now;
    lines.push({
      metric: 'firstResponse',
      state: overdue ? 'breached' : state(sla.firstResponseDueAt),
      dueAt: sla.firstResponseDueAt,
    });
  }

  if (sla.resolutionBreached) {
    lines.push({ metric: 'resolution', state: 'breached', dueAt: sla.resolutionDueAt });
  } else if (sla.isPaused) {
    lines.push({ metric: 'resolution', state: 'paused', dueAt: null });
  } else if (sla.resolutionDueAt) {
    const overdue = Date.parse(sla.resolutionDueAt) <= now;
    lines.push({
      metric: 'resolution',
      state: overdue ? 'breached' : state(sla.resolutionDueAt),
      dueAt: sla.resolutionDueAt,
    });
  }

  return lines;
}

/** The line that most needs attention, for places with room for only one. */
export function mostUrgent(lines: readonly SlaLine[]): SlaLine | null {
  const order: readonly SlaState[] = ['breached', 'soon', 'ok', 'paused', 'met'];
  return [...lines].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))[0] ?? null;
}

/** A clock that ticks twice a minute, so countdowns stay current without reloading. */
@Injectable({ providedIn: 'root' })
export class Ticker {
  readonly now = signal(Date.now());

  constructor() {
    setInterval(() => this.now.set(Date.now()), 30_000);
  }
}

/** Shows the SLA clocks of a ticket: all of them, or only the most urgent one when compact. */
@Component({
  selector: 'app-sla-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslocoPipe],
  template: `
    @for (line of visible(); track line.metric) {
      <span class="sla" [attr.data-state]="line.state">
        <mat-icon aria-hidden="true">{{ icon(line.state) }}</mat-icon>
        <span>
          @if (!compact()) {
            {{ 'sla.metrics.' + line.metric | transloco }}:
          }
          {{ 'sla.states.' + line.state | transloco: { when: relative(line) } }}
        </span>
      </span>
    } @empty {
      <span class="none" aria-hidden="true">—</span>
    }
    @if (sla().isEscalated && !compact() && status() !== 'Closed') {
      <span class="sla" data-state="breached">
        <mat-icon aria-hidden="true">priority_high</mat-icon>
        <span>{{ 'sla.escalated' | transloco }}</span>
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
    }

    .sla {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
      white-space: nowrap;
    }

    .sla mat-icon {
      font-size: 16px;
      inline-size: 16px;
      block-size: 16px;
    }

    .sla[data-state='breached'] {
      color: var(--mat-sys-error);
      font-weight: 600;
    }

    .sla[data-state='soon'] {
      color: var(--mat-sys-tertiary);
      font-weight: 600;
    }

    .none {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class SlaStatus {
  private readonly ticker = inject(Ticker);
  private readonly language = inject(LanguageService);

  readonly sla = input.required<TicketSla>();
  readonly status = input.required<TicketStatus>();
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly visible = computed(() => {
    const lines = slaLines(this.sla(), this.status(), this.ticker.now());
    const urgent = mostUrgent(lines);
    return this.compact() ? (urgent ? [urgent] : []) : lines;
  });

  protected icon(state: SlaState): string {
    switch (state) {
      case 'breached':
        return 'error';
      case 'soon':
        return 'timer';
      case 'met':
        return 'check_circle';
      case 'paused':
        return 'pause_circle';
      default:
        return 'schedule';
    }
  }

  protected relative(line: SlaLine): string {
    return formatLocalDate(
      line.dueAt,
      this.language.language(),
      'relative',
      new Date(this.ticker.now()),
    );
  }
}
