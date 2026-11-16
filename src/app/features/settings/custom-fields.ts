import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import {
  CUSTOM_FIELD_TYPES,
  CustomField,
  CustomFieldType,
  TicketsApi,
} from '../../core/api/tickets.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';

interface FieldDialogData {
  readonly field: CustomField | null;
  readonly nextPosition: number;
}

/** Turns a label such as "Order number" into the key "order_number". */
export function suggestKey(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[a-z]/.test(key) ? key : '';
}

@Component({
  selector: 'app-custom-field-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ (data.field ? 'customFields.editTitle' : 'customFields.createTitle') | transloco }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="form-stack">
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customFields.label' | transloco }}</mat-label>
          <input matInput formControlName="label" cdkFocusInitial (input)="onLabel()" />
          <mat-error>{{ form.controls.label | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customFields.key' | transloco }}</mat-label>
          <input matInput formControlName="key" dir="ltr" (input)="keyEdited = true" />
          <mat-hint>{{ 'customFields.keyHint' | transloco }}</mat-hint>
          <mat-error>
            @if (form.controls.key.hasError('pattern')) {
              {{ 'customFields.keyPattern' | transloco }}
            } @else {
              {{ form.controls.key | fieldError }}
            }
          </mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'customFields.type' | transloco }}</mat-label>
          <mat-select formControlName="type">
            @for (type of types; track type) {
              <mat-option [value]="type">{{ 'customFields.types.' + type | transloco }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (form.controls.type.value === 'Dropdown') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'customFields.options' | transloco }}</mat-label>
            <textarea matInput rows="4" formControlName="options"></textarea>
            <mat-hint>{{ 'customFields.optionsHint' | transloco }}</mat-hint>
            <mat-error>{{ form.controls.options | fieldError }}</mat-error>
          </mat-form-field>
        }
        <mat-checkbox formControlName="isRequired">
          {{ 'customFields.required' | transloco }}
        </mat-checkbox>
        @if (data.field) {
          <mat-checkbox formControlName="isActive">
            {{ 'customFields.active' | transloco }}
          </mat-checkbox>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CustomFieldDialog {
  protected readonly data = inject<FieldDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CustomFieldDialog, CustomField>>(MatDialogRef);
  private readonly api = inject(TicketsApi);
  private readonly notifier = inject(Notifier);

  protected readonly types = CUSTOM_FIELD_TYPES;
  protected keyEdited = false;
  protected readonly form = inject(NonNullableFormBuilder).group({
    label: [this.data.field?.label ?? '', [Validators.required, Validators.maxLength(80)]],
    key: [
      { value: this.data.field?.key ?? '', disabled: this.data.field !== null },
      [Validators.required, Validators.maxLength(40), Validators.pattern(/^[a-z][a-z0-9_]*$/)],
    ],
    type: [
      {
        value: this.data.field?.type ?? ('Text' as CustomFieldType),
        disabled: this.data.field !== null,
      },
    ],
    options: [this.data.field?.options.join('\n') ?? ''],
    isRequired: [this.data.field?.isRequired ?? false],
    isActive: [this.data.field?.isActive ?? true],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onLabel(): void {
    if (!this.data.field && !this.keyEdited) {
      this.form.controls.key.setValue(suggestKey(this.form.controls.label.value));
    }
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const options = value.options
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean);
    if (value.type === 'Dropdown' && options.length === 0) {
      this.form.controls.options.setErrors({ required: true });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const field = this.data.field;
    const common = {
      label: value.label,
      options,
      isRequired: value.isRequired,
      position: field?.position ?? this.data.nextPosition,
    };
    this.submitting.set(true);
    this.error.set(null);
    (field
      ? this.api.updateCustomField(field.id, { ...common, isActive: value.isActive })
      : this.api.createCustomField({ ...common, key: value.key, type: value.type })
    ).subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(this.notifier.problemMessage(problem));
        }

        this.submitting.set(false);
      },
    });
  }
}

@Component({
  selector: 'app-custom-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatTableModule, TranslocoPipe],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'customFields.title' | transloco }}</h1>
        <p>{{ 'customFields.subtitle' | transloco }}</p>
      </div>
      <button mat-flat-button type="button" (click)="edit(null)">
        <mat-icon aria-hidden="true">add</mat-icon>
        {{ 'customFields.create' | transloco }}
      </button>
    </header>

    @if (loaded() && fields().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">tune</mat-icon>
        <h2>{{ 'customFields.emptyTitle' | transloco }}</h2>
        <p>{{ 'customFields.emptyBody' | transloco }}</p>
      </div>
    } @else {
      <div class="table-card">
        <table
          mat-table
          [dataSource]="fields()"
          [attr.aria-label]="'customFields.title' | transloco"
        >
          <ng-container matColumnDef="label">
            <th mat-header-cell *matHeaderCellDef>{{ 'customFields.label' | transloco }}</th>
            <td mat-cell *matCellDef="let field">
              <strong>{{ field.label }}</strong>
              @if (field.isRequired) {
                <span class="badge">{{ 'customFields.requiredBadge' | transloco }}</span>
              }
              @if (!field.isActive) {
                <span class="badge muted">{{ 'customFields.inactiveBadge' | transloco }}</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="key">
            <th mat-header-cell *matHeaderCellDef>{{ 'customFields.key' | transloco }}</th>
            <td mat-cell *matCellDef="let field">
              <code dir="ltr">{{ field.key }}</code>
            </td>
          </ng-container>
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef>{{ 'customFields.type' | transloco }}</th>
            <td mat-cell *matCellDef="let field">
              {{ 'customFields.types.' + field.type | transloco }}
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>
              <span class="visually-hidden">{{ 'common.actions' | transloco }}</span>
            </th>
            <td mat-cell *matCellDef="let field" class="actions">
              <button mat-button type="button" (click)="edit(field)">
                {{ 'common.edit' | transloco }}
              </button>
              <button mat-button type="button" (click)="remove(field)">
                {{ 'common.delete' | transloco }}
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      </div>
    }
  `,
  styles: `
    td strong {
      margin-inline-end: 8px;
    }

    .actions {
      text-align: end;
      white-space: nowrap;
    }
  `,
})
export class CustomFields {
  private readonly api = inject(TicketsApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly notifier = inject(Notifier);

  protected readonly columns = ['label', 'key', 'type', 'actions'];
  protected readonly fields = signal<CustomField[]>([]);
  protected readonly loaded = signal(false);

  constructor() {
    this.load();
  }

  protected edit(field: CustomField | null): void {
    this.dialog
      .open<CustomFieldDialog, FieldDialogData, CustomField>(CustomFieldDialog, {
        data: { field, nextPosition: this.fields().length },
        width: '520px',
      })
      .afterClosed()
      .pipe(filter((saved) => saved !== undefined))
      .subscribe((saved) => {
        this.notifier.success('customFields.saved', { label: saved.label });
        this.load();
      });
  }

  protected remove(field: CustomField): void {
    this.confirm
      .ask({
        title: this.notifier.translate('customFields.deleteTitle', { label: field.label }),
        message: this.notifier.translate('customFields.deleteBody'),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteCustomField(field.id)),
      )
      .subscribe(() => {
        this.notifier.success('customFields.deleted', { label: field.label });
        this.load();
      });
  }

  private load(): void {
    this.api.customFields().subscribe((fields) => {
      this.fields.set(fields);
      this.loaded.set(true);
    });
  }
}
