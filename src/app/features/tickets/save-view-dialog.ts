import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { SavedView, TicketsApi, ViewFilter } from '../../core/api/tickets.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';

export interface SaveViewDialogData {
  readonly filter: ViewFilter;
  readonly canShare: boolean;
}

@Component({
  selector: 'app-save-view-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'tickets.views.saveTitle' | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="form-stack">
        <p class="dialog-lead">{{ 'tickets.views.saveBody' | transloco }}</p>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.views.name' | transloco }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          <mat-error>{{ form.controls.name | fieldError }}</mat-error>
        </mat-form-field>
        @if (data.canShare) {
          <mat-checkbox formControlName="isShared">{{
            'tickets.views.share' | transloco
          }}</mat-checkbox>
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
export class SaveViewDialog {
  protected readonly data = inject<SaveViewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SaveViewDialog, SavedView>>(MatDialogRef);
  private readonly api = inject(TicketsApi);
  private readonly notifier = inject(Notifier);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    isShared: [false],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, isShared } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api.createView(name, isShared && this.data.canShare, this.data.filter).subscribe({
      next: (view) => this.dialogRef.close(view),
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
