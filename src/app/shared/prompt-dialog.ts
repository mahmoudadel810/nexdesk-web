import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, filter } from 'rxjs';
import { FieldErrorPipe } from '../core/ui/field-error.pipe';

export interface PromptOptions {
  readonly title: string;
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
}

@Component({
  selector: 'app-prompt-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ options.title }}</h2>
    <form (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="field">
          <mat-label>{{ options.label }}</mat-label>
          <input matInput cdkFocusInitial [formControl]="control" />
          <mat-error>{{ control | fieldError }}</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit">{{ 'common.save' | transloco }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .field {
      inline-size: 100%;
      margin-block-start: 8px;
    }
  `,
})
export class PromptDialog {
  protected readonly options = inject<PromptOptions>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PromptDialog, string>>(MatDialogRef);

  protected readonly control = new FormControl(this.options.value, {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(this.options.maxLength)],
  });

  protected submit(): void {
    if (this.control.invalid || !this.control.value.trim()) {
      this.control.markAsTouched();
      return;
    }

    this.dialogRef.close(this.control.value.trim());
  }
}

@Injectable({ providedIn: 'root' })
export class Prompt {
  private readonly dialog = inject(MatDialog);

  /** Emits the entered text when the user saves; completes without a value when they cancel. */
  ask(options: PromptOptions): Observable<string> {
    return this.dialog
      .open<PromptDialog, PromptOptions, string>(PromptDialog, { data: options, width: '480px' })
      .afterClosed()
      .pipe(filter((value): value is string => typeof value === 'string'));
  }
}
