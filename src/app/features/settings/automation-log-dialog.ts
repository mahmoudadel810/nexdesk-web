import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AUDIENCE_ADMINS,
  AUDIENCE_ASSIGNEE,
  AutomationApi,
  AutomationExecution,
  AutomationRule,
  ExecutionStep,
} from '../../core/api/automation.api';
import { LocalDatePipe } from '../../shared/local-date.pipe';

/** Says in words what one action of a rule did, for the execution log. */
export function describeStep(
  step: ExecutionStep,
  translate: (key: string, params?: Record<string, unknown>) => string,
): string {
  let value = step.value ?? '';
  if (step.type === 'SetStatus') {
    value = translate(`ticketStatus.${value}`);
  } else if (step.type === 'SetPriority') {
    value = translate(`ticketPriority.${value}`);
  } else if (step.type === 'Notify' && (value === AUDIENCE_ASSIGNEE || value === AUDIENCE_ADMINS)) {
    value = translate(`automation.audience.${value}`);
  }

  return translate(`automation.steps.${step.type}`, { value });
}

@Component({
  selector: 'app-automation-log-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'automation.log.title' | transloco: { name: rule.name } }}</h2>
    <mat-dialog-content>
      @if (loaded() && entries().length === 0) {
        <p class="dialog-lead">{{ 'automation.log.empty' | transloco }}</p>
      }
      <ul class="entries">
        @for (entry of entries(); track entry.id) {
          <li>
            <div class="head">
              <a [routerLink]="['/app/tickets', entry.ticketId]" mat-dialog-close>
                #{{ entry.ticketNumber }} {{ entry.ticketSubject }}
              </a>
              <span class="badge" [class.muted]="entry.outcome !== 'Applied'">
                {{ 'automation.outcome.' + entry.outcome | transloco }}
              </span>
            </div>
            <p class="when">{{ entry.createdAt | localDate }}</p>
            <ul class="steps">
              @for (step of entry.steps; track $index) {
                <li [class.skipped]="!step.applied">
                  <mat-icon aria-hidden="true">{{ step.applied ? 'check' : 'block' }}</mat-icon>
                  <span>
                    {{ describe(step) }}
                    @if (!step.applied) {
                      ({{ 'automation.log.skipped' | transloco }})
                    }
                  </span>
                </li>
              }
            </ul>
          </li>
        }
      </ul>
      @if (entries().length < total()) {
        <button mat-button type="button" (click)="load()">
          {{ 'automation.log.more' | transloco }}
        </button>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.dismiss' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .entries > li {
      padding-block: 12px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .head a {
      color: var(--mat-sys-primary);
      font-weight: 500;
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .when {
      margin: 2px 0 8px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .steps li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding-block: 2px;
    }

    .steps mat-icon {
      flex: none;
      font-size: 18px;
      inline-size: 18px;
      block-size: 18px;
      color: var(--mat-sys-primary);
    }

    .steps .skipped,
    .steps .skipped mat-icon {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AutomationLogDialog {
  protected readonly rule = inject<AutomationRule>(MAT_DIALOG_DATA);
  private readonly api = inject(AutomationApi);
  private readonly transloco = inject(TranslocoService);

  protected readonly entries = signal<readonly AutomationExecution[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  private page = 0;

  constructor() {
    this.load();
  }

  protected describe(step: ExecutionStep): string {
    return describeStep(step, (key, params) => this.transloco.translate(key, params));
  }

  protected load(): void {
    this.page += 1;
    this.api.executions(this.rule.id, this.page).subscribe((result) => {
      this.entries.update((entries) => [...entries, ...result.items]);
      this.total.set(result.totalCount);
      this.loaded.set(true);
    });
  }
}
