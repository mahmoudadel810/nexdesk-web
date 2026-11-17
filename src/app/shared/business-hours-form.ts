import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { BusinessDay, BusinessHours, Weekday } from '../core/api/workspace.api';

export const TIMEZONES: readonly string[] = ['UTC', ...Intl.supportedValuesOf('timeZone')];

/** Editor for the workspace time zone and weekly opening hours. The parent reads <c>value()</c> to save. */
@Component({
  selector: 'app-business-hours-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <form [formGroup]="form" class="hours" novalidate>
      <mat-form-field appearance="outline" class="timezone">
        <mat-label>{{ 'businessHours.timezone' | transloco }}</mat-label>
        <mat-select formControlName="timezone">
          @for (zone of timezones; track zone) {
            <mat-option [value]="zone"
              ><span dir="ltr">{{ zone }}</span></mat-option
            >
          }
        </mat-select>
      </mat-form-field>

      <div
        formArrayName="days"
        class="days"
        role="group"
        [attr.aria-label]="'businessHours.week' | transloco"
      >
        @for (
          day of form.controls.days.controls;
          track day.controls.day.value;
          let index = $index
        ) {
          <div class="day" [formGroupName]="index">
            <mat-slide-toggle formControlName="isWorkingDay">
              {{ 'weekdays.' + day.controls.day.value | transloco }}
            </mat-slide-toggle>
            @if (day.controls.isWorkingDay.value) {
              <span class="times">
                <input
                  type="time"
                  formControlName="startTime"
                  [attr.aria-label]="
                    'businessHours.opensOn'
                      | transloco: { day: ('weekdays.' + day.controls.day.value | transloco) }
                  "
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  formControlName="endTime"
                  [attr.aria-label]="
                    'businessHours.closesOn'
                      | transloco: { day: ('weekdays.' + day.controls.day.value | transloco) }
                  "
                />
              </span>
              @if (day.controls.endTime.value <= day.controls.startTime.value) {
                <span class="problem" role="alert">{{
                  'businessHours.invalidRange' | transloco
                }}</span>
              }
            } @else {
              <span class="closed">{{ 'businessHours.closed' | transloco }}</span>
            }
          </div>
        }
      </div>
      @if (!hasWorkingDay()) {
        <p class="form-alert" role="alert">{{ 'businessHours.needWorkingDay' | transloco }}</p>
      }
    </form>
  `,
  styles: `
    .timezone {
      inline-size: min(100%, 360px);
    }

    .days {
      display: grid;
      gap: 4px;
    }

    .day {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      min-block-size: 48px;
    }

    .day mat-slide-toggle {
      inline-size: 160px;
    }

    .times {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      direction: ltr;
    }

    input[type='time'] {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      padding: 6px 8px;
      color-scheme: inherit;
    }

    input[type='time']:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 1px;
    }

    .closed {
      color: var(--mat-sys-on-surface-variant);
    }

    .problem {
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class BusinessHoursForm {
  private readonly formBuilder = inject(NonNullableFormBuilder);

  readonly hours = input<BusinessHours | null>(null);

  protected readonly timezones = TIMEZONES;
  protected readonly form = this.formBuilder.group({
    timezone: ['UTC', [Validators.required]],
    days: this.formBuilder.array<ReturnType<BusinessHoursForm['dayGroup']>>([]),
  });

  constructor() {
    effect(() => {
      const hours = this.hours();
      if (!hours) {
        return;
      }

      this.form.controls.timezone.setValue(hours.timezone);
      const days = this.form.controls.days as FormArray;
      days.clear();
      for (const day of hours.days) {
        days.push(this.dayGroup(day));
      }
    });
  }

  hasWorkingDay(): boolean {
    return this.form.controls.days.controls.some((day) => day.controls.isWorkingDay.value);
  }

  isValid(): boolean {
    return (
      this.form.valid &&
      this.hasWorkingDay() &&
      this.form.controls.days.controls.every(
        (day) =>
          !day.controls.isWorkingDay.value ||
          day.controls.endTime.value > day.controls.startTime.value,
      )
    );
  }

  value(): BusinessHours {
    const raw = this.form.getRawValue();
    return {
      timezone: raw.timezone,
      days: raw.days.map((day) => ({
        day: day.day,
        isWorkingDay: day.isWorkingDay,
        startTime: `${day.startTime}:00`,
        endTime: `${day.endTime}:00`,
      })),
    };
  }

  private dayGroup(day: BusinessDay) {
    return this.formBuilder.group({
      day: [day.day as Weekday],
      isWorkingDay: [day.isWorkingDay],
      startTime: [day.startTime.slice(0, 5), [Validators.required]],
      endTime: [day.endTime.slice(0, 5), [Validators.required]],
    });
  }
}
