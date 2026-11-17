import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AUDIENCE_ADMINS,
  AUDIENCE_ASSIGNEE,
  AUTOMATION_TRIGGERS,
  AutomationApi,
  AutomationRule,
  AutomationTrigger,
  ConditionField,
  ConditionMatch,
  ConditionOperator,
  NONE,
  RULE_ACTION_TYPES,
  RuleAction,
  RuleActionType,
  RuleCondition,
  fieldsFor,
  operatorsFor,
} from '../../core/api/automation.api';
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from '../../core/api/tickets.api';
import { Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { toProblem } from '../../core/http/problem';
import { Notifier } from '../../core/ui/notifier';

interface ConditionRow {
  readonly field: ConditionField;
  readonly operator: ConditionOperator;
  readonly value: string;
}

interface ActionRow {
  readonly type: RuleActionType;
  readonly value: string;
  readonly subject: string;
  readonly body: string;
}

/** Which input a row needs for its value. */
type ValueKind =
  'none' | 'status' | 'priority' | 'type' | 'channel' | 'user' | 'team' | 'text' | 'hours';

const MAX_ROWS = 10;
const MAX_HOURS = 8760;
const CHANNELS = ['Agent', 'Portal', 'Email', 'Api'] as const;

function conditionKind(row: ConditionRow): ValueKind {
  if (row.operator === 'Changed') {
    return 'none';
  }

  switch (row.field) {
    case 'Status':
      return 'status';
    case 'Priority':
      return 'priority';
    case 'Type':
      return 'type';
    case 'Channel':
      return 'channel';
    case 'Assignee':
      return 'user';
    case 'Team':
      return 'team';
    case 'HoursSinceLastActivity':
    case 'HoursSinceCreated':
      return 'hours';
    default:
      return 'text';
  }
}

function conditionValid(row: ConditionRow): boolean {
  switch (conditionKind(row)) {
    case 'none':
      return true;
    case 'hours': {
      const hours = Number(row.value);
      return Number.isInteger(hours) && hours >= 1 && hours <= MAX_HOURS;
    }
    case 'text':
      return row.value.trim().length > 0 && row.value.trim().length <= 100;
    default:
      return row.value !== '';
  }
}

function actionValid(row: ActionRow): boolean {
  switch (row.type) {
    case 'SendEmail':
      return (
        row.subject.trim().length > 0 && row.subject.length <= 200 && row.body.trim().length > 0
      );
    case 'Notify':
      return row.value !== '' && row.body.trim().length > 0;
    case 'AddTag':
      return row.value.trim().length > 0 && row.value.trim().length <= 40;
    default:
      return row.value !== '';
  }
}

/** Builds or edits an automation rule: when it runs, what must be true, and what it does. */
@Component({
  selector: 'app-automation-rule-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <a class="back" routerLink="/app/settings/automation">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'automation.back' | transloco }}
    </a>

    @if (missing()) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <h2>{{ 'automation.notFoundTitle' | transloco }}</h2>
        <p>{{ 'automation.notFoundBody' | transloco }}</p>
      </div>
    } @else if (ready()) {
      <header class="page-header">
        <div>
          <h1>
            {{
              (rule() ? 'automation.editor.editTitle' : 'automation.editor.newTitle') | transloco
            }}
          </h1>
          <p>{{ 'automation.editor.subtitle' | transloco }}</p>
        </div>
      </header>

      <form class="editor" (ngSubmit)="save()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }

        <mat-card appearance="outlined">
          <mat-card-content class="form-stack">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'automation.editor.name' | transloco }}</mat-label>
              <input
                matInput
                name="name"
                maxlength="120"
                required
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
              />
              @if (submitted() && !name().trim()) {
                <mat-hint class="invalid">{{ 'validation.required' | transloco }}</mat-hint>
              }
            </mat-form-field>
            <div class="row">
              <mat-form-field appearance="outline" class="grow">
                <mat-label>{{ 'automation.editor.trigger' | transloco }}</mat-label>
                <mat-select
                  name="trigger"
                  [ngModel]="trigger()"
                  (ngModelChange)="setTrigger($event)"
                >
                  @for (option of triggers; track option) {
                    <mat-option [value]="option">
                      {{ 'automation.triggers.' + option | transloco }}
                    </mat-option>
                  }
                </mat-select>
                @if (trigger() === 'TimeBased') {
                  <mat-hint>{{ 'automation.editor.timeHint' | transloco }}</mat-hint>
                }
              </mat-form-field>
              <mat-form-field appearance="outline" class="narrow">
                <mat-label>{{ 'automation.editor.position' | transloco }}</mat-label>
                <input
                  matInput
                  type="number"
                  name="position"
                  min="0"
                  max="1000"
                  [ngModel]="position()"
                  (ngModelChange)="position.set($event)"
                />
                <mat-hint>{{ 'automation.editor.positionHint' | transloco }}</mat-hint>
              </mat-form-field>
            </div>
            <mat-slide-toggle
              name="enabled"
              [ngModel]="enabled()"
              (ngModelChange)="enabled.set($event)"
            >
              {{ 'automation.editor.enabled' | transloco }}
            </mat-slide-toggle>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'automation.editor.conditions' | transloco }}</mat-card-title>
            <mat-card-subtitle>{{
              'automation.editor.conditionsHint' | transloco
            }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (conditions().length > 1) {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="match">
                <mat-label>{{ 'automation.editor.match' | transloco }}</mat-label>
                <mat-select
                  name="match"
                  [disabled]="trigger() === 'TimeBased'"
                  [ngModel]="match()"
                  (ngModelChange)="match.set($event)"
                >
                  <mat-option value="All">{{ 'automation.match.All' | transloco }}</mat-option>
                  <mat-option value="Any">{{ 'automation.match.Any' | transloco }}</mat-option>
                </mat-select>
              </mat-form-field>
            }

            @for (row of conditions(); track $index; let index = $index) {
              <fieldset class="rule-row" [class.invalid]="submitted() && !conditionOk(row)">
                <legend class="visually-hidden">
                  {{ 'automation.editor.conditionLabel' | transloco: { number: index + 1 } }}
                </legend>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.editor.field' | transloco }}</mat-label>
                  <mat-select
                    [name]="'conditionField' + index"
                    [ngModel]="row.field"
                    (ngModelChange)="setField(index, $event)"
                  >
                    @for (field of fields(); track field) {
                      <mat-option [value]="field">{{
                        'automation.fields.' + field | transloco
                      }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.editor.operator' | transloco }}</mat-label>
                  <mat-select
                    [name]="'conditionOperator' + index"
                    [ngModel]="row.operator"
                    (ngModelChange)="setOperator(index, $event)"
                  >
                    @for (operator of operators(row.field); track operator) {
                      <mat-option [value]="operator">
                        {{ 'automation.operators.' + operator | transloco }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @switch (kind(row)) {
                  @case ('none') {}
                  @case ('hours') {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'automation.editor.hours' | transloco }}</mat-label>
                      <input
                        matInput
                        type="number"
                        min="1"
                        max="8760"
                        [name]="'conditionValue' + index"
                        [ngModel]="row.value"
                        (ngModelChange)="setConditionValue(index, $event)"
                      />
                    </mat-form-field>
                  }
                  @case ('text') {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'automation.editor.value' | transloco }}</mat-label>
                      <input
                        matInput
                        maxlength="100"
                        [name]="'conditionValue' + index"
                        [ngModel]="row.value"
                        (ngModelChange)="setConditionValue(index, $event)"
                      />
                    </mat-form-field>
                  }
                  @default {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'automation.editor.value' | transloco }}</mat-label>
                      <mat-select
                        [name]="'conditionValue' + index"
                        [ngModel]="row.value"
                        (ngModelChange)="setConditionValue(index, $event)"
                      >
                        @switch (kind(row)) {
                          @case ('status') {
                            @for (status of statuses; track status) {
                              <mat-option [value]="status">
                                {{ 'ticketStatus.' + status | transloco }}
                              </mat-option>
                            }
                          }
                          @case ('priority') {
                            @for (priority of priorities; track priority) {
                              <mat-option [value]="priority">
                                {{ 'ticketPriority.' + priority | transloco }}
                              </mat-option>
                            }
                          }
                          @case ('type') {
                            @for (type of types; track type) {
                              <mat-option [value]="type">{{
                                'ticketType.' + type | transloco
                              }}</mat-option>
                            }
                          }
                          @case ('channel') {
                            @for (channel of channels; track channel) {
                              <mat-option [value]="channel">
                                {{ 'ticketChannel.' + channel | transloco }}
                              </mat-option>
                            }
                          }
                          @case ('user') {
                            <mat-option [value]="none">{{
                              'automation.editor.unassigned' | transloco
                            }}</mat-option>
                            @for (user of users(); track user.id) {
                              <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
                            }
                          }
                          @case ('team') {
                            <mat-option [value]="none">{{
                              'automation.editor.noTeam' | transloco
                            }}</mat-option>
                            @for (team of teams(); track team.id) {
                              <mat-option [value]="team.id">{{ team.name }}</mat-option>
                            }
                          }
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                }
                <button
                  mat-icon-button
                  type="button"
                  class="remove"
                  [attr.aria-label]="
                    'automation.editor.removeCondition' | transloco: { number: index + 1 }
                  "
                  (click)="removeCondition(index)"
                >
                  <mat-icon aria-hidden="true">close</mat-icon>
                </button>
              </fieldset>
            } @empty {
              <p class="muted">{{ 'automation.editor.noConditions' | transloco }}</p>
            }
            <button
              mat-stroked-button
              type="button"
              [disabled]="conditions().length >= maxRows"
              (click)="addCondition()"
            >
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'automation.editor.addCondition' | transloco }}
            </button>
            @if (submitted() && needsDuration()) {
              <p class="form-alert" role="alert">
                {{ 'errors.automation-time-rule-needs-duration' | transloco }}
              </p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ 'automation.editor.actions' | transloco }}</mat-card-title>
            <mat-card-subtitle>{{ 'automation.editor.actionsHint' | transloco }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @for (row of actions(); track $index; let index = $index) {
              <fieldset class="rule-row" [class.invalid]="submitted() && !actionOk(row)">
                <legend class="visually-hidden">
                  {{ 'automation.editor.actionLabel' | transloco: { number: index + 1 } }}
                </legend>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.editor.action' | transloco }}</mat-label>
                  <mat-select
                    [name]="'actionType' + index"
                    [ngModel]="row.type"
                    (ngModelChange)="setActionType(index, $event)"
                  >
                    @for (type of actionTypes; track type) {
                      <mat-option [value]="type">{{
                        'automation.actions.' + type | transloco
                      }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @switch (row.type) {
                  @case ('AddTag') {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>{{ 'automation.editor.tag' | transloco }}</mat-label>
                      <input
                        matInput
                        maxlength="40"
                        [name]="'actionValue' + index"
                        [ngModel]="row.value"
                        (ngModelChange)="patchAction(index, { value: $event })"
                      />
                    </mat-form-field>
                  }
                  @case ('SendEmail') {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                      <mat-label>{{ 'automation.editor.emailSubject' | transloco }}</mat-label>
                      <input
                        matInput
                        maxlength="200"
                        [name]="'actionSubject' + index"
                        [ngModel]="row.subject"
                        (ngModelChange)="patchAction(index, { subject: $event })"
                      />
                    </mat-form-field>
                  }
                  @default {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>
                        {{
                          (row.type === 'Notify'
                            ? 'automation.editor.audience'
                            : 'automation.editor.value'
                          ) | transloco
                        }}
                      </mat-label>
                      <mat-select
                        [name]="'actionValue' + index"
                        [ngModel]="row.value"
                        (ngModelChange)="patchAction(index, { value: $event })"
                      >
                        @switch (row.type) {
                          @case ('AssignUser') {
                            @for (user of assignableUsers(); track user.id) {
                              <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
                            }
                          }
                          @case ('AssignTeam') {
                            @for (team of teams(); track team.id) {
                              <mat-option [value]="team.id">{{ team.name }}</mat-option>
                            }
                          }
                          @case ('SetPriority') {
                            @for (priority of priorities; track priority) {
                              <mat-option [value]="priority">
                                {{ 'ticketPriority.' + priority | transloco }}
                              </mat-option>
                            }
                          }
                          @case ('SetStatus') {
                            @for (status of settableStatuses; track status) {
                              <mat-option [value]="status">
                                {{ 'ticketStatus.' + status | transloco }}
                              </mat-option>
                            }
                          }
                          @case ('Notify') {
                            <mat-option [value]="audienceAssignee">
                              {{ 'automation.audience.assignee' | transloco }}
                            </mat-option>
                            <mat-option [value]="audienceAdmins">
                              {{ 'automation.audience.admins' | transloco }}
                            </mat-option>
                            @for (user of users(); track user.id) {
                              <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
                            }
                          }
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                }
                <button
                  mat-icon-button
                  type="button"
                  class="remove"
                  [attr.aria-label]="
                    'automation.editor.removeAction' | transloco: { number: index + 1 }
                  "
                  (click)="removeAction(index)"
                >
                  <mat-icon aria-hidden="true">close</mat-icon>
                </button>
                @if (row.type === 'SendEmail' || row.type === 'Notify') {
                  <mat-form-field appearance="outline" class="message">
                    <mat-label>
                      {{
                        (row.type === 'SendEmail'
                          ? 'automation.editor.emailBody'
                          : 'automation.editor.message'
                        ) | transloco
                      }}
                    </mat-label>
                    <textarea
                      matInput
                      rows="3"
                      maxlength="4000"
                      [name]="'actionBody' + index"
                      [ngModel]="row.body"
                      (ngModelChange)="patchAction(index, { body: $event })"
                    ></textarea>
                    <mat-hint>
                      {{ 'automation.editor.placeholders' | transloco }}
                      <span dir="ltr">{{ placeholders }}</span>
                    </mat-hint>
                  </mat-form-field>
                }
              </fieldset>
            }
            <button
              mat-stroked-button
              type="button"
              [disabled]="actions().length >= maxRows"
              (click)="addAction()"
            >
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'automation.editor.addAction' | transloco }}
            </button>
            @if (submitted() && actions().length === 0) {
              <p class="form-alert" role="alert">
                {{ 'automation.editor.needsAction' | transloco }}
              </p>
            }
          </mat-card-content>
        </mat-card>

        <div class="form-actions">
          <a mat-button routerLink="/app/settings/automation">{{ 'common.cancel' | transloco }}</a>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-end: 16px;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }

    .editor {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      max-inline-size: 960px;
    }

    mat-card-content {
      padding-block-start: 16px;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .row .grow {
      flex: 3 1 280px;
    }

    .row .narrow {
      flex: 1 1 140px;
    }

    .match {
      display: block;
      max-inline-size: 320px;
      margin-block-end: 16px;
    }

    .rule-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin: 0 0 12px;
      padding: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      min-inline-size: 0;
    }

    .rule-row.invalid {
      border-color: var(--mat-sys-error);
    }

    .rule-row mat-form-field {
      flex: 1 1 180px;
      min-inline-size: 0;
    }

    .rule-row .wide {
      flex: 2 1 280px;
    }

    .rule-row .message {
      flex: 1 1 100%;
    }

    .remove {
      flex: none;
    }

    .muted {
      margin: 0 0 12px;
      color: var(--mat-sys-on-surface-variant);
    }

    .invalid {
      color: var(--mat-sys-error);
    }

    .form-alert {
      margin-block-start: 12px;
    }
  `,
})
export class AutomationRuleEditor {
  private readonly api = inject(AutomationApi);
  private readonly usersApi = inject(UsersApi);
  private readonly teamsApi = inject(TeamsApi);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  /** The rule's id, taken from the route. Absent when building a new rule. */
  readonly id = input<string>();

  protected readonly triggers = AUTOMATION_TRIGGERS;
  protected readonly actionTypes = RULE_ACTION_TYPES;
  protected readonly statuses = TICKET_STATUSES;
  protected readonly settableStatuses = TICKET_STATUSES.filter((status) => status !== 'New');
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly types = TICKET_TYPES;
  protected readonly channels = CHANNELS;
  protected readonly none = NONE;
  protected readonly audienceAssignee = AUDIENCE_ASSIGNEE;
  protected readonly audienceAdmins = AUDIENCE_ADMINS;
  protected readonly maxRows = MAX_ROWS;
  /** The tokens a rule's text may contain, shown to the author as they must be typed. */
  protected readonly placeholders = '{{ticket.number}}, {{ticket.subject}}, {{customer.name}}';

  protected readonly rule = signal<AutomationRule | null>(null);
  protected readonly missing = signal(false);
  protected readonly ready = signal(false);
  protected readonly name = signal('');
  protected readonly trigger = signal<AutomationTrigger>('TicketCreated');
  protected readonly position = signal(0);
  protected readonly enabled = signal(true);
  protected readonly match = signal<ConditionMatch>('All');
  protected readonly conditions = signal<readonly ConditionRow[]>([]);
  protected readonly actions = signal<readonly ActionRow[]>([]);
  protected readonly users = signal<readonly User[]>([]);
  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly fields = computed(() => fieldsFor(this.trigger()));
  protected readonly assignableUsers = computed(() =>
    this.users().filter((user) => user.role !== 'Viewer'),
  );
  /** A scheduled rule needs a duration to wait for; without one it would fire on every ticket. */
  protected readonly needsDuration = computed(
    () =>
      this.trigger() === 'TimeBased' &&
      !this.conditions().some((row) => conditionKind(row) === 'hours'),
  );

  constructor() {
    this.usersApi
      .list({ isActive: true, page: 1, pageSize: 100 })
      .subscribe((page) => this.users.set(page.items));
    this.teamsApi.list().subscribe((teams) => this.teams.set(teams));

    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected kind(row: ConditionRow): ValueKind {
    return conditionKind(row);
  }

  protected conditionOk(row: ConditionRow): boolean {
    return conditionValid(row);
  }

  protected actionOk(row: ActionRow): boolean {
    return actionValid(row);
  }

  protected operators(field: ConditionField): readonly ConditionOperator[] {
    return operatorsFor(field, this.trigger());
  }

  protected setTrigger(trigger: AutomationTrigger): void {
    this.trigger.set(trigger);
    if (trigger === 'TimeBased') {
      this.match.set('All');
    }

    // Conditions the new trigger cannot evaluate are dropped rather than sent and refused.
    const fields = fieldsFor(trigger);
    this.conditions.update((rows) =>
      rows.filter(
        (row) =>
          fields.includes(row.field) && operatorsFor(row.field, trigger).includes(row.operator),
      ),
    );
    if (trigger === 'TimeBased' && this.needsDuration()) {
      this.conditions.update((rows) => [
        { field: 'HoursSinceLastActivity', operator: 'AtLeast', value: '48' },
        ...rows,
      ]);
    }
  }

  protected addCondition(): void {
    const field = this.fields().find((f) => f === 'Status') ?? this.fields()[0];
    this.conditions.update((rows) => [
      ...rows,
      { field, operator: operatorsFor(field, this.trigger())[0], value: '' },
    ]);
  }

  protected setField(index: number, field: ConditionField): void {
    this.patchCondition(index, {
      field,
      operator: operatorsFor(field, this.trigger())[0],
      value: '',
    });
  }

  protected setOperator(index: number, operator: ConditionOperator): void {
    this.patchCondition(index, operator === 'Changed' ? { operator, value: '' } : { operator });
  }

  protected setConditionValue(index: number, value: string | number | null): void {
    this.patchCondition(index, { value: value === null ? '' : String(value) });
  }

  protected removeCondition(index: number): void {
    this.conditions.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected addAction(): void {
    this.actions.update((rows) => [...rows, { type: 'AddTag', value: '', subject: '', body: '' }]);
  }

  protected setActionType(index: number, type: RuleActionType): void {
    this.patchAction(index, { type, value: '', subject: '', body: '' });
  }

  protected patchAction(index: number, patch: Partial<ActionRow>): void {
    this.actions.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  protected removeAction(index: number): void {
    this.actions.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected save(): void {
    this.submitted.set(true);
    this.error.set(null);
    const valid =
      this.name().trim().length > 0 &&
      this.actions().length > 0 &&
      !this.needsDuration() &&
      this.conditions().every(conditionValid) &&
      this.actions().every(actionValid);
    if (!valid) {
      this.error.set(this.notifier.translate('automation.editor.incomplete'));
      return;
    }

    const input = {
      name: this.name().trim(),
      trigger: this.trigger(),
      isEnabled: this.enabled(),
      position: Math.min(1000, Math.max(0, Math.trunc(Number(this.position()) || 0))),
      definition: {
        match: this.match(),
        conditions: this.conditions().map(toCondition),
        actions: this.actions().map(toAction),
      },
    };
    const current = this.rule();
    this.submitting.set(true);
    (current ? this.api.update(current.id, input) : this.api.create(input)).subscribe({
      next: (saved) => {
        this.notifier.success('automation.editor.saved', { name: saved.name });
        void this.router.navigate(['/app/settings/automation']);
      },
      error: (failure: unknown) => {
        this.error.set(this.notifier.problemMessage(toProblem(failure)));
        this.submitting.set(false);
      },
    });
  }

  private patchCondition(index: number, patch: Partial<ConditionRow>): void {
    this.conditions.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  private load(id: string | undefined): void {
    this.missing.set(false);
    if (!id) {
      this.rule.set(null);
      this.actions.set([{ type: 'AddTag', value: '', subject: '', body: '' }]);
      this.ready.set(true);
      return;
    }

    this.api.rule(id).subscribe({
      next: (rule) => {
        this.rule.set(rule);
        this.name.set(rule.name);
        this.trigger.set(rule.trigger);
        this.position.set(rule.position);
        this.enabled.set(rule.isEnabled);
        this.match.set(rule.definition.match);
        this.conditions.set(
          rule.definition.conditions.map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value ?? '',
          })),
        );
        this.actions.set(
          rule.definition.actions.map((action) => ({
            type: action.type,
            value: action.value ?? '',
            subject: action.subject ?? '',
            body: action.body ?? '',
          })),
        );
        this.ready.set(true);
      },
      error: () => this.missing.set(true),
    });
  }
}

function toCondition(row: ConditionRow): RuleCondition {
  return conditionKind(row) === 'none'
    ? { field: row.field, operator: row.operator }
    : { field: row.field, operator: row.operator, value: row.value.trim() };
}

function toAction(row: ActionRow): RuleAction {
  switch (row.type) {
    case 'SendEmail':
      return { type: row.type, subject: row.subject.trim(), body: row.body.trim() };
    case 'Notify':
      return { type: row.type, value: row.value, body: row.body.trim() };
    default:
      return { type: row.type, value: row.value.trim() };
  }
}
