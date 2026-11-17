import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { CustomField, CustomFieldValues } from '../../core/api/tickets.api';

/** Inputs for the tenant-defined ticket fields. Emits one field at a time as it is committed. */
@Component({
  selector: 'app-custom-field-inputs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslocoPipe],
  template: `
    @for (field of activeFields(); track field.key) {
      @switch (field.type) {
        @case ('Checkbox') {
          <mat-checkbox
            [checked]="values()[field.key] === 'true'"
            [disabled]="disabled()"
            (change)="commit(field, $event.checked ? 'true' : 'false')"
          >
            {{ field.label }}
          </mat-checkbox>
        }
        @case ('Dropdown') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ field.label }}</mat-label>
            <mat-select
              [value]="values()[field.key] ?? null"
              [disabled]="disabled()"
              [required]="field.isRequired"
              (valueChange)="commit(field, $event)"
            >
              @if (!field.isRequired) {
                <mat-option [value]="null">{{
                  'tickets.customFields.none' | transloco
                }}</mat-option>
              }
              @for (option of field.options; track option) {
                <mat-option [value]="option">{{ option }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        @default {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ field.label }}</mat-label>
            <input
              matInput
              [type]="field.type === 'Number' ? 'number' : field.type === 'Date' ? 'date' : 'text'"
              [attr.step]="field.type === 'Number' ? 'any' : null"
              [attr.maxlength]="field.type === 'Text' ? 500 : null"
              dir="auto"
              [value]="values()[field.key] ?? ''"
              [disabled]="disabled()"
              [required]="field.isRequired"
              (change)="commit(field, $any($event.target).value)"
            />
          </mat-form-field>
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    mat-form-field {
      inline-size: 100%;
    }
  `,
})
export class CustomFieldInputs {
  readonly fields = input.required<readonly CustomField[]>();
  readonly values = input.required<CustomFieldValues>();
  readonly disabled = input(false);

  readonly valueChange = output<{ readonly key: string; readonly value: string | null }>();

  protected readonly activeFields = computed(() =>
    this.fields()
      .filter((field) => field.isActive)
      .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)),
  );

  protected commit(field: CustomField, raw: string | null): void {
    const value = raw === null || raw.trim() === '' ? null : raw.trim();
    if ((this.values()[field.key] ?? null) !== value) {
      this.valueChange.emit({ key: field.key, value });
    }
  }
}

/** Keys of required fields that have no value yet. */
export function missingRequired(
  fields: readonly CustomField[],
  values: CustomFieldValues,
): readonly string[] {
  return fields
    .filter((field) => field.isActive && field.isRequired && !values[field.key])
    .map((field) => field.label);
}
