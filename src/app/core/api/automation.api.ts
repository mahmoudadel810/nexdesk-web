import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { Paged } from './workspace.api';

export type AutomationTrigger = 'TicketCreated' | 'TicketUpdated' | 'TimeBased';
export type ConditionMatch = 'All' | 'Any';
export type ConditionField =
  | 'Status'
  | 'Priority'
  | 'Type'
  | 'Channel'
  | 'Assignee'
  | 'Team'
  | 'Tags'
  | 'Subject'
  | 'HoursSinceLastActivity'
  | 'HoursSinceCreated';
export type ConditionOperator = 'Is' | 'IsNot' | 'Contains' | 'NotContains' | 'AtLeast' | 'Changed';
export type RuleActionType =
  'AssignUser' | 'AssignTeam' | 'SetPriority' | 'SetStatus' | 'AddTag' | 'SendEmail' | 'Notify';
export type ExecutionOutcome = 'Applied' | 'Partial' | 'Failed';

export const AUTOMATION_TRIGGERS: readonly AutomationTrigger[] = [
  'TicketCreated',
  'TicketUpdated',
  'TimeBased',
];

export const RULE_ACTION_TYPES: readonly RuleActionType[] = [
  'AssignUser',
  'AssignTeam',
  'SetPriority',
  'SetStatus',
  'AddTag',
  'SendEmail',
  'Notify',
];

/** The value of an assignee or team condition that stands for "nobody". */
export const NONE = 'none';
export const AUDIENCE_ASSIGNEE = 'assignee';
export const AUDIENCE_ADMINS = 'admins';

const TIME_FIELDS: readonly ConditionField[] = ['HoursSinceLastActivity', 'HoursSinceCreated'];
const TICKET_FIELDS: readonly ConditionField[] = [
  'Status',
  'Priority',
  'Type',
  'Channel',
  'Assignee',
  'Team',
  'Tags',
  'Subject',
];

const OPERATORS: Record<ConditionField, readonly ConditionOperator[]> = {
  Status: ['Is', 'IsNot', 'Changed'],
  Priority: ['Is', 'IsNot', 'Changed'],
  Type: ['Is', 'IsNot', 'Changed'],
  Channel: ['Is', 'IsNot'],
  Assignee: ['Is', 'IsNot', 'Changed'],
  Team: ['Is', 'IsNot', 'Changed'],
  Tags: ['Contains', 'NotContains', 'Changed'],
  Subject: ['Contains', 'NotContains', 'Changed'],
  HoursSinceLastActivity: ['AtLeast'],
  HoursSinceCreated: ['AtLeast'],
};

/** The fields a rule with this trigger can test. Durations only make sense for scheduled rules. */
export function fieldsFor(trigger: AutomationTrigger): readonly ConditionField[] {
  return trigger === 'TimeBased' ? [...TIME_FIELDS, ...TICKET_FIELDS] : TICKET_FIELDS;
}

/** The comparisons a field supports. "Changed" needs an update to compare against. */
export function operatorsFor(
  field: ConditionField,
  trigger: AutomationTrigger,
): readonly ConditionOperator[] {
  return OPERATORS[field].filter(
    (operator) => operator !== 'Changed' || trigger === 'TicketUpdated',
  );
}

export interface RuleCondition {
  readonly field: ConditionField;
  readonly operator: ConditionOperator;
  readonly value?: string | null;
}

export interface RuleAction {
  readonly type: RuleActionType;
  readonly value?: string | null;
  readonly subject?: string | null;
  readonly body?: string | null;
}

export interface RuleDefinition {
  readonly match: ConditionMatch;
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
}

export interface AutomationRule {
  readonly id: string;
  readonly name: string;
  readonly trigger: AutomationTrigger;
  readonly isEnabled: boolean;
  readonly position: number;
  readonly definition: RuleDefinition;
  readonly runCount: number;
  readonly lastRunAt: string | null;
  readonly createdAt: string;
}

export interface AutomationRuleInput {
  readonly name: string;
  readonly trigger: AutomationTrigger;
  readonly isEnabled: boolean;
  readonly position: number;
  readonly definition: RuleDefinition;
}

export interface ExecutionStep {
  readonly type: RuleActionType;
  readonly value: string | null;
  readonly applied: boolean;
}

export interface AutomationExecution {
  readonly id: string;
  readonly ruleId: string;
  readonly ticketId: string;
  readonly ticketNumber: number;
  readonly ticketSubject: string;
  readonly outcome: ExecutionOutcome;
  readonly steps: readonly ExecutionStep[];
  readonly createdAt: string;
}

const API = `${environment.apiUrl}/automation/rules`;

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class AutomationApi {
  private readonly http = inject(HttpClient);

  rules(): Observable<AutomationRule[]> {
    return this.http.get<AutomationRule[]>(API);
  }

  rule(ruleId: string): Observable<AutomationRule> {
    return this.http.get<AutomationRule>(`${API}/${ruleId}`, inline());
  }

  create(input: AutomationRuleInput): Observable<AutomationRule> {
    return this.http.post<AutomationRule>(API, input, inline());
  }

  update(ruleId: string, input: AutomationRuleInput): Observable<AutomationRule> {
    return this.http.put<AutomationRule>(`${API}/${ruleId}`, input, inline());
  }

  setEnabled(ruleId: string, isEnabled: boolean): Observable<AutomationRule> {
    return this.http.post<AutomationRule>(
      `${API}/${ruleId}/${isEnabled ? 'enable' : 'disable'}`,
      null,
    );
  }

  delete(ruleId: string): Observable<void> {
    return this.http.delete<void>(`${API}/${ruleId}`);
  }

  executions(ruleId: string, page: number, pageSize = 20): Observable<Paged<AutomationExecution>> {
    return this.http.get<Paged<AutomationExecution>>(`${API}/${ruleId}/executions`, {
      params: new HttpParams().set('page', page).set('pageSize', pageSize),
    });
  }
}
