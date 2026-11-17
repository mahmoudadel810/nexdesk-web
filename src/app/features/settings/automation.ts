import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import { AutomationApi, AutomationRule } from '../../core/api/automation.api';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { AutomationLogDialog } from './automation-log-dialog';

@Component({
  selector: 'app-automation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSlideToggleModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'automation.title' | transloco }}</h1>
        <p>{{ 'automation.subtitle' | transloco }}</p>
      </div>
      <a mat-flat-button routerLink="/app/settings/automation/new">
        <mat-icon aria-hidden="true">add</mat-icon>
        {{ 'automation.newRule' | transloco }}
      </a>
    </header>

    @if (loaded() && rules().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">bolt</mat-icon>
        <h2>{{ 'automation.emptyTitle' | transloco }}</h2>
        <p>{{ 'automation.emptyBody' | transloco }}</p>
      </div>
    }

    <div class="rules">
      @for (rule of rules(); track rule.id) {
        <mat-card appearance="outlined" [class.off]="!rule.isEnabled">
          <mat-card-header>
            <mat-card-title>
              <a [routerLink]="['/app/settings/automation', rule.id]">{{ rule.name }}</a>
            </mat-card-title>
            <mat-card-subtitle>
              {{ 'automation.triggers.' + rule.trigger | transloco }} ·
              {{
                'automation.summary'
                  | transloco
                    : {
                        conditions: rule.definition.conditions.length,
                        actions: rule.definition.actions.length,
                      }
              }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="runs">
              @if (rule.lastRunAt) {
                {{ 'automation.ran' | transloco: { count: rule.runCount } }} ·
                {{ 'automation.lastRun' | transloco }} {{ rule.lastRunAt | localDate: 'relative' }}
              } @else {
                {{ 'automation.neverRan' | transloco }}
              }
            </p>
          </mat-card-content>
          <mat-card-actions>
            <mat-slide-toggle
              [checked]="rule.isEnabled"
              [attr.aria-label]="'automation.enabledLabel' | transloco: { name: rule.name }"
              (change)="toggle(rule, $event.checked)"
            >
              {{ (rule.isEnabled ? 'automation.on' : 'automation.off') | transloco }}
            </mat-slide-toggle>
            <span class="spacer"></span>
            <button mat-button type="button" (click)="showLog(rule)">
              {{ 'automation.log.open' | transloco }}
            </button>
            <a mat-button [routerLink]="['/app/settings/automation', rule.id]">
              {{ 'common.edit' | transloco }}
            </a>
            <button mat-button type="button" (click)="remove(rule)">
              {{ 'common.delete' | transloco }}
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .rules {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      max-inline-size: 880px;
    }

    mat-card-title a {
      color: inherit;
      text-decoration: none;
    }

    mat-card-title a:hover {
      text-decoration: underline;
    }

    .off mat-card-title,
    .off mat-card-subtitle {
      opacity: 0.6;
    }

    .runs {
      margin: 12px 0 0;
      color: var(--mat-sys-on-surface-variant);
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
export class Automation {
  private readonly api = inject(AutomationApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly notifier = inject(Notifier);

  protected readonly rules = signal<readonly AutomationRule[]>([]);
  protected readonly loaded = signal(false);

  constructor() {
    this.load();
  }

  protected toggle(rule: AutomationRule, isEnabled: boolean): void {
    this.api.setEnabled(rule.id, isEnabled).subscribe({
      next: (saved) =>
        this.rules.update((rules) => rules.map((r) => (r.id === saved.id ? saved : r))),
      error: () => this.load(),
    });
  }

  protected showLog(rule: AutomationRule): void {
    this.dialog.open(AutomationLogDialog, { data: rule, width: '640px' });
  }

  protected remove(rule: AutomationRule): void {
    this.confirm
      .ask({
        title: this.notifier.translate('automation.delete.title', { name: rule.name }),
        message: this.notifier.translate('automation.delete.body'),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.delete(rule.id)),
      )
      .subscribe(() => {
        this.notifier.success('automation.delete.done');
        this.load();
      });
  }

  private load(): void {
    this.api.rules().subscribe((rules) => {
      this.rules.set(rules);
      this.loaded.set(true);
    });
  }
}
