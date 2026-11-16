import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { Holiday, SlaApi, SlaPolicy } from '../../core/api/sla.api';
import { TICKET_PRIORITIES, TicketPriority } from '../../core/api/tickets.api';
import { BusinessHours, WorkspaceApi } from '../../core/api/workspace.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { BusinessHoursForm } from '../../shared/business-hours-form';
import { LocalDatePipe } from '../../shared/local-date.pipe';

/** Formats working minutes as "4 h 30 min" using translated unit labels. */
export function formatDuration(minutes: number, hourLabel: string, minuteLabel: string): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [
    hours > 0 ? `${hours} ${hourLabel}` : '',
    rest > 0 || hours === 0 ? `${rest} ${minuteLabel}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const MAX_MINUTES = 60 * 24 * 90;

@Component({
  selector: 'app-sla-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusinessHoursForm,
    FieldErrorPipe,
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'slaSettings.title' | transloco }}</h1>
        <p>{{ 'slaSettings.subtitle' | transloco }}</p>
      </div>
    </header>

    <div class="sections">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'slaSettings.targets.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'slaSettings.targets.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="policyForm" (ngSubmit)="savePolicies()" novalidate>
            <div
              class="targets"
              role="table"
              [attr.aria-label]="'slaSettings.targets.title' | transloco"
            >
              <div class="row head" role="row">
                <span role="columnheader">{{ 'tickets.fields.priority' | transloco }}</span>
                <span role="columnheader">{{
                  'slaSettings.targets.firstResponse' | transloco
                }}</span>
                <span role="columnheader">{{ 'slaSettings.targets.resolution' | transloco }}</span>
              </div>
              @for (priority of priorities; track priority) {
                <div class="row" role="row" [formGroupName]="priority">
                  <strong role="rowheader">{{ 'ticketPriority.' + priority | transloco }}</strong>
                  <mat-form-field appearance="outline" role="cell">
                    <mat-label>{{ 'slaSettings.targets.minutes' | transloco }}</mat-label>
                    <input matInput type="number" min="1" formControlName="firstResponseMinutes" />
                    <mat-hint>{{
                      duration(policyForm.controls[priority].controls.firstResponseMinutes.value)
                    }}</mat-hint>
                    <mat-error>
                      {{ policyForm.controls[priority].controls.firstResponseMinutes | fieldError }}
                    </mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline" role="cell">
                    <mat-label>{{ 'slaSettings.targets.minutes' | transloco }}</mat-label>
                    <input matInput type="number" min="1" formControlName="resolutionMinutes" />
                    <mat-hint>{{
                      duration(policyForm.controls[priority].controls.resolutionMinutes.value)
                    }}</mat-hint>
                    <mat-error>
                      {{ policyForm.controls[priority].controls.resolutionMinutes | fieldError }}
                    </mat-error>
                  </mat-form-field>
                </div>
              }
            </div>
            @if (policyError(); as message) {
              <p class="form-alert" role="alert">{{ message }}</p>
            }
            <div class="form-actions">
              <button mat-flat-button type="submit" [disabled]="savingPolicies()">
                {{ 'common.save' | transloco }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'slaSettings.hours.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'slaSettings.hours.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <app-business-hours-form [hours]="hours()" />
          <div class="form-actions">
            <button mat-flat-button type="button" [disabled]="savingHours()" (click)="saveHours()">
              {{ 'common.save' | transloco }}
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'slaSettings.holidays.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'slaSettings.holidays.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form class="holiday-form" [formGroup]="holidayForm" (ngSubmit)="addHoliday()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'slaSettings.holidays.date' | transloco }}</mat-label>
              <input matInput type="date" formControlName="date" />
              <mat-error>{{ holidayForm.controls.date | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="name">
              <mat-label>{{ 'slaSettings.holidays.name' | transloco }}</mat-label>
              <input matInput formControlName="name" />
              <mat-error>{{ holidayForm.controls.name | fieldError }}</mat-error>
            </mat-form-field>
            <button mat-stroked-button type="submit" [disabled]="addingHoliday()">
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'slaSettings.holidays.add' | transloco }}
            </button>
          </form>
          @if (holidayError(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <ul class="holidays">
            @for (holiday of holidays(); track holiday.id) {
              <li>
                <span>
                  <strong>{{ holiday.name }}</strong>
                  {{ holiday.date + 'T00:00:00' | localDate: 'date' }}
                </span>
                <button
                  mat-icon-button
                  type="button"
                  [attr.aria-label]="
                    'slaSettings.holidays.remove' | transloco: { name: holiday.name }
                  "
                  (click)="removeHoliday(holiday)"
                >
                  <mat-icon aria-hidden="true">delete</mat-icon>
                </button>
              </li>
            } @empty {
              <li class="muted">{{ 'slaSettings.holidays.empty' | transloco }}</li>
            }
          </ul>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .sections {
      display: grid;
      gap: 16px;
      max-inline-size: 880px;
    }

    mat-card-content {
      padding-block-start: 16px;
    }

    .targets {
      display: grid;
      gap: 4px;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(80px, 1fr) repeat(2, minmax(140px, 220px));
      gap: 12px;
      align-items: start;
    }

    .row strong {
      padding-block-start: 16px;
    }

    .head {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      padding-block-end: 4px;
    }

    .holiday-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
    }

    .holiday-form .name {
      flex: 1 1 220px;
    }

    .holiday-form button {
      margin-block-start: 8px;
    }

    .holidays {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }

    .holidays li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-block-size: 48px;
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }

    .holidays strong {
      margin-inline-end: 8px;
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 600px) {
      .row {
        grid-template-columns: 1fr 1fr;
      }

      .row strong,
      .head span:first-child {
        grid-column: 1 / -1;
        padding-block-start: 8px;
      }
    }
  `,
})
export class SlaSettings {
  private readonly slaApi = inject(SlaApi);
  private readonly workspaceApi = inject(WorkspaceApi);
  private readonly notifier = inject(Notifier);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private readonly hoursForm = viewChild.required(BusinessHoursForm);

  protected readonly priorities = [...TICKET_PRIORITIES].reverse();
  protected readonly hours = signal<BusinessHours | null>(null);
  protected readonly holidays = signal<readonly Holiday[]>([]);
  protected readonly savingPolicies = signal(false);
  protected readonly savingHours = signal(false);
  protected readonly addingHoliday = signal(false);
  protected readonly policyError = signal<string | null>(null);
  protected readonly holidayError = signal<string | null>(null);

  protected readonly policyForm = this.formBuilder.group({
    Urgent: this.policyGroup(),
    High: this.policyGroup(),
    Normal: this.policyGroup(),
    Low: this.policyGroup(),
  });

  protected readonly holidayForm = this.formBuilder.group({
    date: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
  });

  constructor() {
    this.slaApi.policies().subscribe((policies) => this.showPolicies(policies));
    this.workspaceApi.businessHours().subscribe((hours) => this.hours.set(hours));
    this.slaApi.holidays().subscribe((holidays) => this.holidays.set(holidays));
  }

  protected duration(minutes: number): string {
    return minutes > 0
      ? formatDuration(
          minutes,
          this.notifier.translate('slaSettings.units.hours'),
          this.notifier.translate('slaSettings.units.minutes'),
        )
      : '';
  }

  protected savePolicies(): void {
    if (this.policyForm.invalid) {
      this.policyForm.markAllAsTouched();
      return;
    }

    const value = this.policyForm.getRawValue();
    const policies: SlaPolicy[] = (Object.keys(value) as TicketPriority[]).map((priority) => ({
      priority,
      ...value[priority],
    }));
    if (policies.some((policy) => policy.resolutionMinutes < policy.firstResponseMinutes)) {
      this.policyError.set(this.notifier.translate('slaSettings.targets.orderError'));
      return;
    }

    this.savingPolicies.set(true);
    this.policyError.set(null);
    this.slaApi.updatePolicies(policies).subscribe({
      next: (saved) => {
        this.showPolicies(saved);
        this.notifier.success('slaSettings.targets.saved');
        this.savingPolicies.set(false);
      },
      error: () => this.savingPolicies.set(false),
    });
  }

  protected saveHours(): void {
    const form = this.hoursForm();
    if (!form.isValid()) {
      return;
    }

    this.savingHours.set(true);
    this.workspaceApi.updateBusinessHours(form.value()).subscribe({
      next: (hours) => {
        this.hours.set(hours);
        this.notifier.success('slaSettings.hours.saved');
        this.savingHours.set(false);
      },
      error: (failure: unknown) => {
        this.notifier.problem(toProblem(failure));
        this.savingHours.set(false);
      },
    });
  }

  protected addHoliday(): void {
    if (this.holidayForm.invalid) {
      this.holidayForm.markAllAsTouched();
      return;
    }

    const { date, name } = this.holidayForm.getRawValue();
    this.addingHoliday.set(true);
    this.holidayError.set(null);
    this.slaApi.addHoliday(date, name).subscribe({
      next: (holiday) => {
        this.holidays.update((holidays) =>
          [...holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)),
        );
        this.holidayForm.reset();
        this.addingHoliday.set(false);
      },
      error: (failure: unknown) => {
        this.holidayError.set(this.notifier.problemMessage(toProblem(failure)));
        this.addingHoliday.set(false);
      },
    });
  }

  protected removeHoliday(holiday: Holiday): void {
    this.slaApi.deleteHoliday(holiday.id).subscribe(() => {
      this.holidays.update((holidays) => holidays.filter((item) => item.id !== holiday.id));
    });
  }

  private showPolicies(policies: readonly SlaPolicy[]): void {
    for (const policy of policies) {
      this.policyForm.controls[policy.priority].setValue({
        firstResponseMinutes: policy.firstResponseMinutes,
        resolutionMinutes: policy.resolutionMinutes,
      });
    }
  }

  private policyGroup() {
    const rules = [Validators.required, Validators.min(1), Validators.max(MAX_MINUTES)];
    return this.formBuilder.group({
      firstResponseMinutes: [60, rules],
      resolutionMinutes: [480, rules],
    });
  }
}
