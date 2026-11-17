import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import {
  AutomationRule,
  AutomationRuleInput,
  fieldsFor,
  operatorsFor,
} from '../../core/api/automation.api';
import { describeStep } from './automation-log-dialog';
import { AutomationRuleEditor } from './automation-rule-editor';

const RULES_URL = '/api/v1/automation/rules';
const RULE: AutomationRule = {
  id: 'rule-1',
  name: 'Solve requests that wait two days',
  trigger: 'TimeBased',
  isEnabled: true,
  position: 2,
  definition: {
    match: 'All',
    conditions: [
      { field: 'Status', operator: 'Is', value: 'Pending' },
      { field: 'HoursSinceLastActivity', operator: 'AtLeast', value: '48' },
    ],
    actions: [
      { type: 'SetStatus', value: 'Solved' },
      { type: 'SendEmail', subject: 'Closing your request', body: 'Hi {{customer.name}}' },
    ],
  },
  runCount: 3,
  lastRunAt: '2026-01-02T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const translate = (key: string, params?: Record<string, unknown>) =>
  `${key}${params ? `(${String(params['value'])})` : ''}`;

describe('Automation rules', () => {
  it('offers durations only to scheduled rules and "changed" only to update rules', () => {
    expect(fieldsFor('TicketCreated')).not.toContain('HoursSinceLastActivity');
    expect(fieldsFor('TimeBased')).toContain('HoursSinceLastActivity');
    expect(operatorsFor('Status', 'TicketUpdated')).toEqual(['Is', 'IsNot', 'Changed']);
    expect(operatorsFor('Status', 'TicketCreated')).toEqual(['Is', 'IsNot']);
    expect(operatorsFor('HoursSinceCreated', 'TimeBased')).toEqual(['AtLeast']);
  });

  it('describes log steps with translated statuses, priorities and audiences', () => {
    expect(describeStep({ type: 'SetStatus', value: 'Solved', applied: true }, translate)).toBe(
      'automation.steps.SetStatus(ticketStatus.Solved)',
    );
    expect(describeStep({ type: 'Notify', value: 'admins', applied: true }, translate)).toBe(
      'automation.steps.Notify(automation.audience.admins)',
    );
    expect(describeStep({ type: 'Notify', value: 'Aaron Agent', applied: true }, translate)).toBe(
      'automation.steps.Notify(Aaron Agent)',
    );
    expect(describeStep({ type: 'AddTag', value: 'vip', applied: false }, translate)).toBe(
      'automation.steps.AddTag(vip)',
    );
  });
});

describe('AutomationRuleEditor', () => {
  let fixture: ComponentFixture<AutomationRuleEditor>;
  let backend: HttpTestingController;
  let element: HTMLElement;

  async function render(id?: string): Promise<void> {
    TestBed.configureTestingModule({
      imports: [
        AutomationRuleEditor,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AutomationRuleEditor);
    if (id) {
      fixture.componentRef.setInput('id', id);
    }

    await fixture.whenStable();
    backend
      .expectOne((request) => request.url === '/api/v1/users')
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0 });
    backend.expectOne('/api/v1/teams').flush([]);
    if (id) {
      backend.expectOne(`${RULES_URL}/${id}`).flush(RULE);
    }

    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    return [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
  }

  async function type(selector: string, value: string): Promise<void> {
    const control = element.querySelector(selector) as HTMLInputElement;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  afterEach(() => backend.verify());

  it('refuses to save an incomplete rule and points at what is missing', async () => {
    await render();

    button('Save').click();
    await fixture.whenStable();

    expect(element.querySelector('.form-alert')?.textContent).toContain('Complete the highlighted');
    expect(element.querySelectorAll('.rule-row.invalid').length).toBe(1);
  });

  it('saves a new rule with its conditions and actions', async () => {
    await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await type('input[name=name]', '  Tag new tickets ');
    await type('input[name=actionValue0]', 'inbox');
    button('Add condition').click();
    await fixture.whenStable();
    expect(element.querySelectorAll('.rule-row').length).toBe(2);
    (element.querySelector('[aria-label="Remove condition 1"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    button('Save').click();
    await fixture.whenStable();

    const request = backend.expectOne(RULES_URL);
    expect(request.request.body as AutomationRuleInput).toEqual({
      name: 'Tag new tickets',
      trigger: 'TicketCreated',
      isEnabled: true,
      position: 0,
      definition: { match: 'All', conditions: [], actions: [{ type: 'AddTag', value: 'inbox' }] },
    });
    request.flush({ ...RULE, name: 'Tag new tickets' });
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/app/settings/automation']);
  });

  it('loads an existing rule and sends it back unchanged', async () => {
    await render('rule-1');

    expect((element.querySelector('input[name=name]') as HTMLInputElement).value).toBe(RULE.name);
    expect(element.querySelectorAll('.rule-row').length).toBe(4);
    expect(element.textContent).toContain('{{ticket.number}}');

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    button('Save').click();
    await fixture.whenStable();

    const request = backend.expectOne(`${RULES_URL}/rule-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body as AutomationRuleInput).toEqual({
      name: RULE.name,
      trigger: RULE.trigger,
      isEnabled: true,
      position: 2,
      definition: RULE.definition,
    });
    request.flush(RULE);
  });

  it('shows the server reason when a rule is refused', async () => {
    await render('rule-1');

    button('Save').click();
    await fixture.whenStable();
    backend
      .expectOne(`${RULES_URL}/rule-1`)
      .flush(
        { code: 'automation-invalid-action', title: 'Bad request', status: 400 },
        { status: 400, statusText: 'Bad Request' },
      );
    await fixture.whenStable();

    expect(element.querySelector('.form-alert')?.textContent).toContain(
      'One of the actions is not valid',
    );
  });
});
